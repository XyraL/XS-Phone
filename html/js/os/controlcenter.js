PhoneOS.controlCenter = (() => {
    let el = null;
    let open = false;

    // Settings the panel can flip. Saving is debounced the same way the Settings
    // app does it, so flicking a toggle twice does not spend two writes.
    let saveTimer = null;
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            const res = await PhoneOS.nui('saveSettings', PhoneOS.state.settings);
            if (res && res.ok) return;
            if (res && res.error === 'rate_limited') { saveTimer = setTimeout(save, 6000); return; }
            PhoneOS.notify({ app: 'settings', title: 'Settings', body: 'Couldn\'t save your changes.' });
        }, 400);
    }

    function tile(opts) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cc-tile' + (opts.wide ? ' cc-wide' : '') + (opts.on ? ' on' : '');
        const ic = document.createElement('div');
        ic.className = 'cc-ic';
        ic.innerHTML = opts.icon;
        const lb = document.createElement('div');
        lb.className = 'cc-label';
        lb.textContent = opts.label;
        b.append(ic, lb);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            opts.onTap(b);
        });
        return b;
    }

    const ICON = {
        plane: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
        moon: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>',
        torch: '<svg viewBox="0 0 24 24"><path d="M9 2h6v3l-1 2v3h-4V7L9 5zm1 10h4v8a2 2 0 0 1-4 0z"/></svg>',
        camera: '<svg viewBox="0 0 24 24"><path d="M9 4l-1.2 2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.8L15 4H9zm3 4.5A4.5 4.5 0 1 1 12 17.5 4.5 4.5 0 0 1 12 8.5z"/></svg>',
        calc: '<svg viewBox="0 0 24 24"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm1 3v3h10V5zm0 6v2h3v-2zm5 0v2h3v-2zm-5 4v2h3v-2zm5 0v2h3v-2z"/></svg>',
        stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
    };

    function build() {
        const panel = document.createElement('div');
        panel.className = 'cc-panel';
        panel.addEventListener('click', (e) => e.stopPropagation());

        const grid = document.createElement('div');
        grid.className = 'cc-grid';

        const s = PhoneOS.state.settings;

        grid.append(tile({
            icon: ICON.plane, label: 'Airplane', on: !!s.airplane,
            onTap: (b) => {
                s.airplane = !s.airplane;
                b.classList.toggle('on', s.airplane);
                PhoneOS.shell.applySettings();
                save();
            },
        }));

        grid.append(tile({
            icon: ICON.moon, label: 'Do Not Disturb', on: !!s.dnd,
            onTap: (b) => {
                s.dnd = !s.dnd;
                b.classList.toggle('on', s.dnd);
                save();
            },
        }));

        grid.append(tile({
            icon: ICON.torch, label: 'Torch', on: !!PhoneOS.torchOn,
            onTap: async (b) => {
                PhoneOS.torchOn = !PhoneOS.torchOn;
                b.classList.toggle('on', PhoneOS.torchOn);
                const res = await PhoneOS.nui('torch', { on: PhoneOS.torchOn });
                if (res && res.ok === false) {
                    PhoneOS.torchOn = false;
                    b.classList.remove('on');
                }
            },
        }));

        grid.append(tile({
            icon: ICON.camera, label: 'Camera',
            onTap: () => { hide(); PhoneOS.router.openApp('camera'); },
        }));

        grid.append(tile({
            icon: ICON.calc, label: 'Calculator',
            onTap: () => { hide(); PhoneOS.router.openApp('calculator'); },
        }));

        grid.append(tile({
            icon: ICON.stop, label: 'Stop Music',
            onTap: () => { if (PhoneOS.musicStop) PhoneOS.musicStop(); },
        }));

        panel.append(grid);

        // Brightness dims the screen locally. It is deliberately not a saved
        // setting — it is a "right now" control, like a real phone slider.
        const bright = document.createElement('div');
        bright.className = 'cc-slider';
        const bIcon = document.createElement('span');
        bIcon.className = 'cc-slider-ic';
        bIcon.textContent = '☀';
        const range = document.createElement('input');
        range.type = 'range';
        range.min = '35';
        range.max = '100';
        range.value = String(PhoneOS.brightness || 100);
        range.addEventListener('input', () => {
            PhoneOS.brightness = Number(range.value);
            document.getElementById('phone-screen').style.filter =
                PhoneOS.brightness >= 100 ? '' : `brightness(${PhoneOS.brightness / 100})`;
        });
        bright.append(bIcon, range);
        panel.append(bright);

        return panel;
    }

    function show() {
        if (open || !PhoneOS.state) return;
        hideOthers();
        el = build();
        document.getElementById('phone-screen').append(el);
        void el.offsetWidth;
        el.classList.add('in');
        open = true;
    }

    function hide() {
        if (!open || !el) return;
        open = false;
        el.classList.remove('in');
        const dead = el;
        el = null;
        setTimeout(() => dead.remove(), 240);
    }

    function toggle() {
        open ? hide() : show();
    }

    function hideOthers() {
        const nc = document.getElementById('notif-center');
        if (nc) nc.classList.add('hidden');
    }

    PhoneOS.on('phone:close', hide);

    return { show, hide, toggle, isOpen: () => open };
})();
