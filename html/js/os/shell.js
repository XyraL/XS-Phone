PhoneOS.shell = (() => {
    let locked = true;
    let bootedThisSession = false;

    const screen = () => document.getElementById('phone-screen');

    function applySettings() {
        const s = PhoneOS.state.settings;
        const el = screen();
        el.className = el.className
            .replace(/wp-\w+/g, '').replace(/theme-\w+/g, '')
            .replace(/accent-\w+/g, '').replace(/ts-\w+/g, '')
            .trim();

        if (s.wallpaper && s.wallpaper.startsWith('url:')) {
            PhoneOS.glass.wallpaper(s.wallpaper.slice(4));
            el.classList.add('theme-' + s.theme);
        } else {
            PhoneOS.glass.wallpaper(null);
            el.classList.add(`wp-${s.wallpaper}`, `theme-${s.theme}`);
        }
        el.classList.add(`accent-${s.accent || 'blue'}`, `ts-${s.textScale || 'default'}`);
        const frame = document.getElementById('phone-frame');
        frame.className = frame.className.replace(/frame-\w+/g, '').trim();
        frame.classList.add('frame-' + (s.frame || 'midnight'));
        document.getElementById('statusbar').classList.toggle('airplane', !!s.airplane);
        PhoneOS.clock.tick();
        PhoneOS.glass.sync();
    }

    let saveTimer = null;
    PhoneOS.saveSettings = function () {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            const res = await PhoneOS.nui('saveSettings', PhoneOS.state.settings);
            if (res && res.error === 'rate_limited') PhoneOS.saveSettings();
        }, 600);
    };

    function lock() {
        locked = true;
        screen().classList.add('locked');
        if (PhoneOS.home && PhoneOS.home.isEditing()) PhoneOS.home.stopEditing();
        pinShowing = false;
        const cur = PhoneOS.router.current();
        if (cur && cur.noResume) PhoneOS.router.home();
        document.querySelectorAll('.pin-overlay').forEach((el) => el.remove());
        document.getElementById('app-layer').classList.add('hidden');
        document.getElementById('homescreen').classList.add('hidden');
        const ls = document.getElementById('lockscreen');
        ls.classList.remove('hidden', 'unlocking');
        if (PhoneOS.lockscreen) PhoneOS.lockscreen.refresh();
    }

    function reallyUnlock() {
        locked = false;
        screen().classList.remove('locked');
        PhoneOS.sounds.thump();
        const ls = document.getElementById('lockscreen');
        ls.classList.add('unlocking');
        setTimeout(() => {
            ls.classList.add('hidden');
            const layer = document.getElementById('app-layer');
            if (layer.children.length) {
                layer.classList.remove('hidden');
            } else {
                document.getElementById('homescreen').classList.remove('hidden');
            }
            PhoneOS.glass.sync();
        }, 330);
    }

    let pinShowing = false;
    function unlock() {
        if (!locked || pinShowing) return;
        if (!PhoneOS.state || !PhoneOS.state.hasPin) {
            reallyUnlock();
            return;
        }

        pinShowing = true;
        const overlay = document.createElement('div');
        overlay.className = 'pin-overlay';
        const pad = PhoneOS.ui.pinPad({
            title: 'Enter Passcode',
            onComplete: async (pin) => {
                const res = await PhoneOS.api('pin:verify', { pin });
                if (res && res.ok && res.valid) {
                    overlay.remove();
                    pinShowing = false;
                    reallyUnlock();
                } else {
                    pad.setTitle(res && res.error === 'rate_limited'
                        ? 'Too many attempts' : 'Wrong Passcode');
                    pad.reset(true);
                }
            },
        });
        overlay.append(pad);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.remove(); pinShowing = false; }
        });
        screen().append(overlay);
    }

    function open(data) {
        const prevNumber = PhoneOS.state && PhoneOS.state.number;
        if (prevNumber && prevNumber !== data.number) PhoneOS.router.home();
        PhoneOS.state = data;
        PhoneOS.data = { contacts: null, threads: null, photos: null };
        document.querySelector('#bootscreen .boot-name').textContent = data.os || 'XyraLOS';
        for (const [app, count] of Object.entries(data.badges || {})) {
            if (count > 0) PhoneOS.badges[app] = count;
        }
        applySettings();
        PhoneOS.home.build();
        lock();
        if (PhoneOS.endPeek) PhoneOS.endPeek();
        document.getElementById('phone-root').classList.remove('hidden');

        if (!data.settings.setupDone && PhoneOS.setup) {
            PhoneOS.setup.start();
        }

        if (!bootedThisSession) {
            bootedThisSession = true;
            const boot = document.getElementById('bootscreen');
            boot.classList.remove('hidden');
            setTimeout(() => boot.classList.add('hidden'), 1300);
        }
        PhoneOS.clock.tick();
    }

    function close() {
        document.getElementById('phone-root').classList.add('hidden');
        lock(); // reopening always lands on the lock screen
    }

    document.addEventListener('DOMContentLoaded', () => {
        const ls = document.getElementById('lockscreen');
        let dragStart = null;
        ls.addEventListener('pointerdown', (e) => {
            dragStart = e.clientY;
            ls.style.transition = 'none';
            try { ls.setPointerCapture(e.pointerId); } catch (err) {  }
        });
        ls.addEventListener('pointermove', (e) => {
            if (dragStart === null) return;
            const dy = Math.min(0, e.clientY - dragStart);
            ls.style.transform = `translateY(${dy}px)`;
        });
        ls.addEventListener('pointerup', (e) => {
            if (dragStart === null) return;
            const dy = e.clientY - dragStart;
            dragStart = null;
            ls.style.transition = '';
            ls.style.transform = '';
            if (dy < -70 || Math.abs(dy) < 8) unlock();
        });

        document.getElementById('ls-camera').addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });
        document.getElementById('ls-camera').addEventListener('click', (e) => {
            e.stopPropagation();
            PhoneOS.router.openApp('camera');
        });
        document.getElementById('home-indicator').addEventListener('click', () => {
            PhoneOS.router.home();
        });
        document.querySelector('.btn-power').addEventListener('click', lock);

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (PhoneOS.IN_GAME) {
                PhoneOS.nui('close');
            } else {
                close(); // browser preview: just hide it
                setTimeout(() => open(PhoneOS.state), 600);
            }
        });
    });

    PhoneOS.on('phone:open', open);
    PhoneOS.on('phone:close', close);

    function finishSetup() {
        lock();
        unlock();
    }

    PhoneOS.isOpen = () => {
        const c = document.getElementById('phone-root').classList;
        return !c.contains('hidden') && !c.contains('peek-in') && !c.contains('peek-out');
    };

    return { open, close, lock, unlock, isLocked: () => locked, applySettings, finishSetup };
})();
