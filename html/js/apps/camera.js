(() => {
    let selfie = false;
    let busy = false;
    let live = false;
    let zoom = 1;
    let grid = false;
    let keyHandler = null;

    function stopLive() {
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler, true);
            keyHandler = null;
        }
        const hud = document.getElementById('camera-hud');
        if (hud) hud.remove();
        document.body.classList.remove('cam-full');
        if (!live) return;
        live = false;
        PhoneOS.nui('cameraMode', { active: false });
    }

    function hudToast(hud, text) {
        const t = document.createElement('div');
        t.className = 'cam-toast';
        t.textContent = text;
        hud.append(t);
        setTimeout(() => t.classList.add('out'), 2600);
        setTimeout(() => t.remove(), 3300);
    }

    const dig = (obj, path) => String(path).split('.').reduce(
        (o, k) => (o && typeof o === 'object') ? o[k] : undefined, obj);

    async function cropAndUpload(shot) {
        const img = new Image();
        img.src = shot.image;
        await img.decode();
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const f = 1 / zoom;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img,
            Math.round((w - w * f) / 2), Math.round((h - h * f) / 2),
            Math.round(w * f), Math.round(h * f), 0, 0, w, h);
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
        if (!blob) return null;
        const up = shot.upload;
        const fd = new FormData();
        fd.append(up.field, blob, 'photo.jpg');
        const res = await fetch(up.url, {
            method: 'POST',
            headers: up.key ? { [up.header]: up.key } : {},
            body: fd,
        });
        const body = await res.json().catch(() => null);
        const url = dig(body, up.path);
        return typeof url === 'string' ? url : null;
    }

    function render(view, params) {
        view.classList.add('camera-view');
        selfie = !!(params && params.selfie);
        zoom = 1;
        live = true;
        document.body.classList.add('cam-full');
        PhoneOS.nui('cameraMode', { active: true });
        if (selfie) PhoneOS.nui('cameraFlip', { selfie: true });

        const oldHud = document.getElementById('camera-hud');
        if (oldHud) oldHud.remove();
        const hud = document.createElement('div');
        hud.id = 'camera-hud';

        const gridEl = document.createElement('div');
        gridEl.className = 'cam-grid';
        gridEl.classList.toggle('on', grid);

        const zoomFrame = document.createElement('div');
        zoomFrame.className = 'cam-zoomframe';
        zoomFrame.hidden = true;

        const focus = document.createElement('div');
        focus.className = 'cam-focus';

        const flash = document.createElement('div');
        flash.className = 'cam-flash';

        const top = document.createElement('div');
        top.className = 'cam-top';
        const exit = document.createElement('button');
        exit.className = 'cam-round';
        exit.textContent = '✕';
        exit.title = 'Back to phone';
        exit.addEventListener('click', () => PhoneOS.router.home());
        const hint = document.createElement('div');
        hint.className = 'cam-hint';
        hint.textContent = 'Move the mouse to aim · Scroll to zoom · Enter to snap';
        setTimeout(() => hint.classList.add('fade'), 4000);
        const gridBtn = document.createElement('button');
        gridBtn.className = 'cam-round';
        gridBtn.classList.toggle('on', grid);
        gridBtn.title = 'Grid';
        gridBtn.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></svg>';
        gridBtn.addEventListener('click', () => {
            grid = !grid;
            gridBtn.classList.toggle('on', grid);
            gridEl.classList.toggle('on', grid);
        });
        top.append(exit, hint, gridBtn);

        const zoomRow = document.createElement('div');
        zoomRow.className = 'camera-zoom';
        const chips = {};
        for (const z of [1, 2, 3]) {
            const c = document.createElement('button');
            c.className = 'zoom-chip';
            c.textContent = z + '×';
            c.addEventListener('click', () => setZoom(z));
            chips[z] = c;
            zoomRow.append(c);
        }
        chips[1].classList.add('on');

        function setZoom(z) {
            zoom = Math.max(1, Math.min(3, Math.round(z * 10) / 10));
            const nearest = zoom < 1.75 ? 1 : zoom < 2.75 ? 2 : 3;
            for (const [k, c] of Object.entries(chips)) {
                const active = Number(k) === nearest;
                c.classList.toggle('on', active);
                c.textContent = (active ? String(zoom).replace(/\.0$/, '') : k) + '×';
            }
            zoomFrame.style.inset = ((1 - 1 / zoom) / 2 * 100) + '%';
            zoomFrame.hidden = zoom <= 1.01;
        }

        const mode = document.createElement('div');
        mode.className = 'cam-mode';
        mode.textContent = 'PHOTO';

        const controls = document.createElement('div');
        controls.className = 'cam-controls';

        const toGallery = document.createElement('button');
        toGallery.className = 'camera-thumb';
        toGallery.innerHTML = PhoneOS.glyphs.gallery;
        toGallery.addEventListener('click', () => PhoneOS.router.openApp('gallery'));

        const shutter = document.createElement('button');
        shutter.className = 'camera-shutter';
        shutter.addEventListener('click', capture);

        const flip = document.createElement('button');
        flip.className = 'camera-flip';
        flip.textContent = '⟲';
        flip.title = 'Flip camera';
        flip.addEventListener('click', () => {
            selfie = !selfie;
            flip.classList.toggle('on', selfie);
            mode.textContent = selfie ? 'SELFIE' : 'PHOTO';
            PhoneOS.nui('cameraFlip', { selfie });
        });

        controls.append(toGallery, shutter, flip);

        const bottom = document.createElement('div');
        bottom.className = 'cam-bottom';
        bottom.append(zoomRow, controls, mode);

        hud.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            focus.style.left = e.clientX + 'px';
            focus.style.top = e.clientY + 'px';
            focus.classList.remove('ping');
            void focus.offsetWidth;
            focus.classList.add('ping');
        });
        hud.addEventListener('wheel', (e) => {
            e.preventDefault();
            setZoom(zoom + (e.deltaY < 0 ? 0.2 : -0.2));
        }, { passive: false });

        async function capture() {
            if (busy || !live) return;
            busy = true;
            shutter.classList.add('snapping');

            const shot = await PhoneOS.nui('cameraCapture');
            if (!shot || !shot.ok) {
                busy = false;
                shutter.classList.remove('snapping');
                hudToast(hud, {
                    no_screenshot_basic: 'screenshot-basic is not running on this server.',
                    not_configured: 'No upload key set. Add your fivemanage API key to Config.Phone.Media.apiKey.',
                    upload_failed: 'Upload failed — check the media provider.',
                    timeout: 'Capture timed out.',
                }[shot && shot.error] || 'Couldn\'t take the photo.');
                return;
            }

            let url = shot.url || null;
            if (!url && shot.image) {
                try { url = await cropAndUpload(shot); } catch (err) { url = null; }
            }
            if (!url) {
                busy = false;
                shutter.classList.remove('snapping');
                hudToast(hud, 'Upload failed — check the media provider.');
                return;
            }

            flash.classList.remove('pop');
            void flash.offsetWidth;
            flash.classList.add('pop');
            PhoneOS.sounds.tick();

            const saved = await PhoneOS.api('gallery:save', { url });
            busy = false;
            shutter.classList.remove('snapping');
            if (saved && saved.ok) {
                PhoneOS.data.photos = null;
                toGallery.classList.add('has-photo', 'pop');
                toGallery.style.backgroundImage = `url("${url}")`;
                setTimeout(() => toGallery.classList.remove('pop'), 450);
            } else {
                hudToast(hud, saved && saved.error === 'full'
                    ? 'Gallery is full — delete some photos.'
                    : 'Couldn\'t save the photo.');
            }
        }

        keyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                PhoneOS.router.home();
                return;
            }
            if (e.key !== 'Enter' || !live || busy) return;
            const el = document.activeElement;
            if (el && el.matches('input, textarea')) return;
            capture();
        };
        document.addEventListener('keydown', keyHandler, true);

        hud.append(gridEl, zoomFrame, focus, top, bottom, flash);
        document.body.append(hud);
    }

    PhoneOS.on('phone:capturing', (on) => {
        document.getElementById('phone-root').classList.toggle('capturing', !!on);
        const hud = document.getElementById('camera-hud');
        if (hud) hud.classList.toggle('capturing', !!on);
    });

    PhoneOS.on('phone:callState', (data) => {
        if (live && data && data.phase === 'incoming') PhoneOS.router.home();
    });

    PhoneOS.registerApp({
        id: 'camera', name: 'Camera',
        iconBg: 'linear-gradient(135deg,#4a4a4f,#2c2c30)',
        glyph: PhoneOS.glyphs.camera,
        render,
        noResume: true,
        onClose: stopLive,
    });
})();
