(() => {
    const ui = PhoneOS.ui;

    let playing = null; // { id, title }
    let volume = 30;
    let devAudio = null;

    async function play(track) {
        if (!PhoneOS.IN_GAME) {
            try {
                if (devAudio) devAudio.pause();
                devAudio = new Audio(track.url);
                devAudio.volume = volume / 100;
                devAudio.play().catch(() => {});
            } catch (e) {  }
            playing = track;
            return true;
        }
        const res = await PhoneOS.nui('musicPlay', { url: track.url, volume });
        if (res && res.ok) { playing = track; return true; }
        PhoneOS.notify({ app: 'music', title: 'Music', body: res && res.error === 'no_xsound'
            ? 'This server doesn\'t have xsound installed.' : 'Couldn\'t play that track.' });
        return false;
    }

    function stop() {
        if (!PhoneOS.IN_GAME) {
            if (devAudio) devAudio.pause();
            devAudio = null;
        } else {
            PhoneOS.nui('musicStop');
        }
        playing = null;
    }

    function setVolume(v) {
        volume = v;
        if (!PhoneOS.IN_GAME) {
            if (devAudio) devAudio.volume = v / 100;
        } else {
            PhoneOS.nui('musicVolume', { volume: v });
        }
    }

    async function render(view) {
        view.textContent = '';
        view.append(ui.header('Music', {
            action: { label: '+', onTap: () => addScreen(view) },
        }));

        const content = ui.content();
        const res = await PhoneOS.api('music:list');
        const tracks = (res && res.ok && res.data) || [];

        if (playing) {
            const now = document.createElement('div');
            now.className = 'music-now';
            const info = document.createElement('div');
            info.className = 'mn-info';
            const t = document.createElement('div');
            t.className = 'mn-title';
            t.textContent = playing.title;
            const s = document.createElement('div');
            s.className = 'mn-sub';
            s.textContent = 'Now playing';
            info.append(t, s);

            const stopBtn = document.createElement('button');
            stopBtn.className = 'mn-stop';
            stopBtn.textContent = '■';
            stopBtn.addEventListener('click', () => { stop(); render(view); });

            const volWrap = document.createElement('div');
            volWrap.className = 'mn-vol';
            const vol = document.createElement('input');
            vol.type = 'range';
            vol.min = '0'; vol.max = '100'; vol.value = String(volume);
            vol.addEventListener('input', () => setVolume(Number(vol.value)));
            volWrap.append(vol);

            now.append(info, stopBtn);
            content.append(now, volWrap);
        }

        if (!tracks.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Your playlist is empty. Add a track with any audio URL.';
            content.append(empty);
        } else {
            content.append(ui.label('Playlist'));
            content.append(ui.group(tracks.map((track) => {
                const isPlaying = playing && playing.id === track.id;
                const r = ui.row({
                    text: track.title,
                    value: isPlaying ? '▶' : '',
                    onTap: async () => {
                        if (isPlaying) { stop(); } else { await play(track); }
                        render(view);
                    },
                });
                r.classList.add('tappable');
                const del = document.createElement('button');
                del.className = 'pc-delete';
                del.textContent = '✕';
                del.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (playing && playing.id === track.id) stop();
                    await PhoneOS.api('music:delete', { id: track.id });
                    render(view);
                });
                r.append(del);
                return r;
            })));
        }
        view.append(content);
    }

    function addScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Music', onTap: () => render(view) } }));

        const content = ui.content();
        content.append(ui.label('Add track'));

        const titleInput = ui.textInput({ placeholder: 'Title' });
        const urlInput = ui.textInput({ placeholder: 'Audio URL (mp3, stream…)' });
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(titleInput, urlInput);
        content.append(form);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const add = document.createElement('button');
        add.className = 'primary-btn';
        add.textContent = 'Add to Playlist';
        add.addEventListener('click', async () => {
            error.textContent = '';
            const res = await PhoneOS.api('music:add', {
                title: titleInput.value.trim(), url: urlInput.value.trim(),
            });
            if (res && res.ok) { render(view); return; }
            error.textContent = {
                empty: 'Give the track a title.',
                bad_url: 'That doesn\'t look like a URL.',
                full: 'Playlist is full — remove something first.',
            }[res && res.error] || 'Couldn\'t add the track.';
        });
        content.append(add);
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'music', name: 'Music', store: true,
        iconBg: 'linear-gradient(135deg,#fc5c7d,#c644fc)',
        glyph: PhoneOS.glyphs.music,
        render,
    });
})();
