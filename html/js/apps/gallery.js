(() => {
    const ui = PhoneOS.ui;

    async function loadPhotos(force) {
        if (PhoneOS.data.photos && !force) return PhoneOS.data.photos;
        const res = await PhoneOS.api('gallery:list');
        PhoneOS.data.photos = (res && res.ok && res.data) || [];
        return PhoneOS.data.photos;
    }

    function photoGrid(photos, onTap) {
        const grid = document.createElement('div');
        grid.className = 'photo-grid';
        for (const p of photos) {
            const cell = document.createElement('div');
            cell.className = 'photo-cell';
            cell.style.backgroundImage = `url("${p.url}")`;
            cell.addEventListener('click', () => onTap(p));
            grid.append(cell);
        }
        return grid;
    }

    async function importFromUrl(urlValue) {
        const res = await PhoneOS.api('gallery:importUrl', { url: urlValue });
        if (res && res.ok) {
            PhoneOS.data.photos = null;
            return res.data;
        }
        PhoneOS.notify({ app: 'gallery', title: 'Photos', body: {
            bad_host: 'That link isn\'t from an allowed image host (Discord and Imgur work).',
            full: 'Gallery is full — delete some photos.',
            rate_limited: 'Slow down a little.',
        }[res && res.error] || 'Couldn\'t import that link.' });
        return null;
    }

    async function render(view) {
        view.textContent = '';
        view.append(ui.header('Photos', {
            action: { label: '+', onTap: () => importScreen(view) },
        }));

        const content = ui.content();
        const photos = await loadPhotos();

        if (!photos.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No photos yet. Take one with the Camera, or import a link with +.';
            content.append(empty);
        } else {
            content.append(photoGrid(photos, (p) => viewer(view, p)));
        }
        view.append(content);
    }

    function importScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Photos', onTap: () => render(view) } }));

        const content = ui.content();
        content.append(ui.label('Add photos'));
        content.append(ui.group([
            ui.row({ text: 'Open Camera', chevron: true, onTap: () => PhoneOS.router.openApp('camera') }),
        ]));

        content.append(ui.label('Import from a link'));
        const urlInput = ui.textInput({ placeholder: 'https://cdn.discordapp.com/…' });
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(urlInput);
        content.append(form);

        const add = document.createElement('button');
        add.className = 'primary-btn';
        add.textContent = 'Import';
        add.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            if (!url) return;
            add.disabled = true;
            const photo = await importFromUrl(url);
            add.disabled = false;
            if (photo) render(view);
        });
        content.append(add);
        view.append(content);
    }

    function viewer(view, photo) {
        view.textContent = '';
        const photos = PhoneOS.data.photos || [photo];
        let idx = Math.max(0, photos.findIndex((p) => p.id === photo.id));

        const head = ui.header('', { back: { label: 'Photos', onTap: () => render(view) } });
        const counter = document.createElement('div');
        counter.className = 'chat-title';
        head.insertBefore(counter, head.querySelector('.ah-action'));
        view.append(head);

        const stage = document.createElement('div');
        stage.className = 'photo-stage';
        const prev = document.createElement('button');
        prev.className = 'photo-nav';
        prev.textContent = '‹';
        const img = document.createElement('img');
        img.className = 'photo-full';
        const next = document.createElement('button');
        next.className = 'photo-nav';
        next.textContent = '›';
        stage.append(prev, img, next);
        view.append(stage);

        function paint() {
            photo = photos[idx];
            img.src = photo.url;
            counter.textContent = `${idx + 1} of ${photos.length}`;
            prev.disabled = idx === 0;
            next.disabled = idx === photos.length - 1;
        }
        prev.addEventListener('click', () => { if (idx > 0) { idx--; paint(); } });
        next.addEventListener('click', () => { if (idx < photos.length - 1) { idx++; paint(); } });
        paint();

        const bar = document.createElement('div');
        bar.className = 'photo-actions';

        const asWallpaper = document.createElement('button');
        asWallpaper.className = 'contact-action';
        asWallpaper.textContent = 'Set as Wallpaper';
        asWallpaper.addEventListener('click', async () => {
            PhoneOS.state.settings.wallpaper = 'url:' + photo.url;
            PhoneOS.shell.applySettings();
            const res = await PhoneOS.nui('saveSettings', PhoneOS.state.settings);
            PhoneOS.notify({ app: 'gallery', title: 'Photos', body:
                res && res.ok ? 'Wallpaper updated.' : 'Couldn\'t save the wallpaper.' });
        });

        const del = document.createElement('button');
        del.className = 'contact-action photo-delete';
        del.textContent = 'Delete';
        del.addEventListener('click', async () => {
            if (await ui.confirm(view, 'Delete this photo?', 'Delete')) {
                await PhoneOS.api('gallery:delete', { id: photo.id });
                await loadPhotos(true);
                render(view);
            }
        });

        bar.append(asWallpaper, del);
        view.append(bar);
    }

    PhoneOS.pickPhoto = function (opts = {}) {
        const withCamera = opts.camera !== false;
        const withUrl = opts.url !== false;

        return new Promise(async (resolve) => {
            const photos = await loadPhotos();
            const overlay = document.createElement('div');
            overlay.className = 'picker-overlay';
            const done = (p) => { overlay.remove(); resolve(p); };

            const sheet = document.createElement('div');
            sheet.className = 'picker-sheet';
            const title = document.createElement('div');
            title.className = 'picker-title';
            title.textContent = photos.length ? 'Choose a photo' : 'No photos in your gallery';
            sheet.append(title);

            if (withCamera) {
                const snap = document.createElement('button');
                snap.className = 'contact-action picker-source';
                snap.textContent = '📷 Take Photo';
                snap.addEventListener('click', async () => {
                    snap.disabled = true;
                    snap.textContent = 'Taking photo…';
                    const shot = await PhoneOS.nui('cameraCapture');
                    if (shot && shot.ok) {
                        const saved = await PhoneOS.api('gallery:save', { url: shot.url });
                        if (saved && saved.ok) {
                            PhoneOS.data.photos = null;
                            done(saved.data);
                            return;
                        }
                    }
                    snap.disabled = false;
                    snap.textContent = '📷 Take Photo';
                    PhoneOS.notify({ app: 'camera', title: 'Camera', body: 'Couldn\'t take the photo.' });
                });
                sheet.append(snap);
            }

            if (withUrl) {
                const urlRow = document.createElement('div');
                urlRow.className = 'picker-url-row';
                const urlInput = ui.textInput({ placeholder: 'Paste an image link…' });
                const go = document.createElement('button');
                go.className = 'chat-send';
                go.textContent = '›';
                go.addEventListener('click', async () => {
                    const url = urlInput.value.trim();
                    if (!url) return;
                    go.disabled = true;
                    const photo = await importFromUrl(url);
                    go.disabled = false;
                    if (photo) done(photo);
                });
                urlRow.append(urlInput, go);
                sheet.append(urlRow);
            }

            if (photos.length) {
                sheet.append(photoGrid(photos, done));
            }

            const cancel = document.createElement('button');
            cancel.className = 'confirm-btn';
            cancel.textContent = 'Cancel';
            cancel.addEventListener('click', () => done(null));
            sheet.append(cancel);

            overlay.append(sheet);
            document.getElementById('phone-screen').append(overlay);
        });
    };

    PhoneOS.registerApp({
        id: 'gallery', name: 'Photos',
        iconBg: 'linear-gradient(135deg,#ffb199,#ff5e62)',
        glyph: PhoneOS.glyphs.gallery,
        render,
    });
})();
