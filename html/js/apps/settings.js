(() => {
    const ui = PhoneOS.ui;

    const WALLPAPERS = [
        { id: 'aurora',   name: 'Aurora' },
        { id: 'sunset',   name: 'Sunset' },
        { id: 'ocean',    name: 'Ocean' },
        { id: 'midnight', name: 'Midnight' },
        { id: 'rose',     name: 'Rose' },
        { id: 'emerald',  name: 'Emerald' },
        { id: 'gold',     name: 'Gold' },
        { id: 'graphite', name: 'Graphite' },
        { id: 'cipher',   name: 'Cipher' },
    ];
    const ACCENTS = ['blue', 'teal', 'amber', 'purple', 'green', 'rose'];
    const TEXT_SCALES = [['small', 'Small'], ['default', 'Default'], ['large', 'Large']];
    const RINGTONES = ['horizon', 'classic', 'pulse'];
    const TEXTTONES = ['pop', 'chime', 'ding'];

    PhoneOS.themeOptions = { wallpapers: WALLPAPERS, accents: ACCENTS };

    let saveTimer = null;
    function save(delay) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            const res = await PhoneOS.nui('saveSettings', PhoneOS.state.settings);
            if (res && res.ok) return;
            if (res && res.error === 'rate_limited') {
                save(6000);
                return;
            }
            PhoneOS.notify({ app: 'settings', title: 'Settings', body: 'Couldn\'t save your changes.' });
        }, delay || 400);
    }

    const settingToggle = (key) => ui.toggle(!!PhoneOS.state.settings[key], (on) => {
        PhoneOS.state.settings[key] = on;
        PhoneOS.clock.tick(); // 24-hour toggle repaints immediately
        save();
    });

    function cap(s) {
        return s ? s[0].toUpperCase() + s.slice(1) : '';
    }

    function mainScreen(view) {
        view.textContent = '';
        const s = PhoneOS.state;
        view.append(ui.header('Settings'));

        const content = ui.content();

        const hero = document.createElement('div');
        hero.className = 'settings-hero';
        const avatar = ui.avatar(s.number || '?', 64);
        avatar.classList.add('sh-avatar');
        const num = document.createElement('div');
        num.className = 'sh-number';
        num.textContent = s.number || 'No number';
        const os = document.createElement('div');
        os.className = 'sh-os';
        os.textContent = `${s.os} · your number`;
        hero.append(avatar, num, os);

        const segment = (key, options) => {
            const seg = document.createElement('div');
            seg.className = 'seg-control';
            for (const [value, labelText] of options) {
                const opt = document.createElement('div');
                opt.className = 'seg-option' + (s.settings[key] === value ? ' selected' : '');
                opt.textContent = labelText;
                opt.addEventListener('click', () => {
                    s.settings[key] = value;
                    PhoneOS.shell.applySettings();
                    mainScreen(view);
                    save();
                });
                seg.append(opt);
            }
            return seg;
        };

        const accents = document.createElement('div');
        accents.className = 'accent-dots';
        for (const id of ACCENTS) {
            const dot = document.createElement('div');
            dot.className = 'accent-dot accent-' + id
                + (s.settings.accent === id ? ' selected' : '');
            dot.addEventListener('click', () => {
                s.settings.accent = id;
                PhoneOS.shell.applySettings();
                mainScreen(view);
                save();
            });
            accents.append(dot);
        }

        content.append(
            hero,
            ui.label('General'),
            ui.group([
                ui.row({ text: 'Airplane Mode', control: settingToggle('airplane') }),
                ui.row({ text: 'Do Not Disturb', control: settingToggle('dnd') }),
                ui.row({ text: 'Receive Drops', control: settingToggle('dropEnabled') }),
                ui.row({ text: '24-Hour Time', control: settingToggle('time24') }),
                ui.row({ text: 'Lock Screen Previews', control: settingToggle('lockPreviews') }),
            ]),
            ui.label('Appearance'),
            ui.group([
                ui.row({ text: 'Theme', control: segment('theme', [['dark', 'Dark'], ['light', 'Light']]) }),
                ui.row({ text: 'Accent', control: accents }),
                ui.row({ text: 'Text Size', control: segment('textScale', TEXT_SCALES) }),
            ]),
            ui.label('Personalization'),
            ui.group([
                ui.row({
                    text: 'Wallpaper',
                    value: WALLPAPERS.find((w) => w.id === s.settings.wallpaper)?.name || '',
                    chevron: true,
                    onTap: () => wallpaperScreen(view),
                }),
                ui.row({
                    text: 'Sounds',
                    value: cap(s.settings.ringtone),
                    chevron: true,
                    onTap: () => soundsScreen(view),
                }),
            ]),
            ui.label('Security'),
            ui.group([
                ui.row({
                    text: 'Passcode',
                    value: PhoneOS.state.hasPin ? 'On' : 'Off',
                    chevron: true,
                    onTap: () => passcodeScreen(view),
                }),
            ]),
            ui.label('Phone Number'),
            ui.group([
                ui.row({ text: 'Your Number', value: s.number }),
                ui.row({ text: 'Get a New Number', chevron: true, onTap: async () => {
                    if (!await ui.confirm(view,
                        'Get a new number? Your contacts, photos, socials and matches come with you — old conversations and call history stay with the old number.',
                        'New Number', { danger: false })) return;
                    const res = await PhoneOS.api('phone:changeNumber');
                    if (res && res.ok) {
                        PhoneOS.dispatch('phone:open', res.data);
                        PhoneOS.notify({ app: 'settings', title: 'New number',
                            body: `You're now reachable at ${res.data.number}.` });
                    } else {
                        PhoneOS.notify({ app: 'settings', title: 'Settings', body: {
                            insufficient: 'You can\'t afford a new number.',
                            busy: 'Finish your call first.',
                            rate_limited: 'You just changed it — give it a minute.',
                        }[res && res.error] || 'Couldn\'t change your number.' });
                    }
                } }),
            ]),
            ui.label('About'),
            ui.group([
                ui.row({ text: 'System', value: `${s.os} ${s.version}` }),
                ui.row({ text: 'Test Notification', chevron: true, onTap: () => {
                    PhoneOS.notify({ app: 'settings', title: 'Hello!', body: 'Notifications are working.' });
                } }),
            ]),
        );

        const footer = document.createElement('div');
        footer.className = 'about-footer';
        footer.textContent = 'cipher-phone by XyraL';
        content.append(footer);

        view.append(content);
    }

    function wallpaperScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Settings', onTap: () => mainScreen(view) } }));

        const content = ui.content();
        content.append(ui.label('Choose a wallpaper'));

        const grid = document.createElement('div');
        grid.className = 'wp-swatches';
        for (const wp of WALLPAPERS) {
            const sw = document.createElement('div');
            sw.className = `wp-swatch wp-${wp.id}` +
                (PhoneOS.state.settings.wallpaper === wp.id ? ' selected' : '');
            const name = document.createElement('div');
            name.className = 'wp-name';
            name.textContent = wp.name;
            sw.append(name);
            sw.addEventListener('click', () => {
                PhoneOS.state.settings.wallpaper = wp.id;
                PhoneOS.shell.applySettings();
                wallpaperScreen(view);
                save();
            });
            grid.append(sw);
        }
        content.append(grid);
        view.append(content);
    }

    function passcodeScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Settings', onTap: () => mainScreen(view) } }));

        const content = ui.content();
        const hasPin = PhoneOS.state.hasPin;

        const runPad = (title) => new Promise((resolve) => {
            content.textContent = '';
            const pad = ui.pinPad({ title, onComplete: resolve });
            pad.classList.add('pin-inline');
            content.append(pad);
            pad.focusReset = () => pad.reset(true);
            content._pad = pad;
        });

        const fail = (msg) => {
            PhoneOS.notify({ app: 'settings', title: 'Passcode', body: msg });
            passcodeScreen(view);
        };

        const setFlow = async (current) => {
            const first = await runPad('New Passcode');
            const second = await runPad('Confirm Passcode');
            if (first !== second) return fail('Passcodes didn\'t match.');
            const res = await PhoneOS.api('pin:set', { pin: first, current });
            if (!res || !res.ok) return fail('Couldn\'t set the passcode.');
            PhoneOS.state.hasPin = true;
            PhoneOS.notify({ app: 'settings', title: 'Passcode', body: 'Passcode on.' });
            mainScreen(view);
        };

        if (!hasPin) {
            setFlow(undefined);
            view.append(content);
            return;
        }

        content.append(ui.label('Passcode is on'));
        content.append(ui.group([
            ui.row({ text: 'Change Passcode', chevron: true, onTap: async () => {
                const current = await runPad('Current Passcode');
                const check = await PhoneOS.api('pin:verify', { pin: current });
                if (!check || !check.ok || !check.valid) return fail('Wrong passcode.');
                setFlow(current);
            } }),
            ui.row({ text: 'Turn Off Passcode', danger: true, onTap: async () => {
                const current = await runPad('Current Passcode');
                const res = await PhoneOS.api('pin:set', { pin: null, current });
                if (!res || !res.ok) return fail('Wrong passcode.');
                PhoneOS.state.hasPin = false;
                PhoneOS.notify({ app: 'settings', title: 'Passcode', body: 'Passcode off.' });
                mainScreen(view);
            } }),
        ]));
        view.append(content);
    }

    function soundsScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Settings', onTap: () => mainScreen(view) } }));

        const content = ui.content();

        const pickerGroup = (title, options, key) => {
            content.append(ui.label(title));
            content.append(ui.group(options.map((opt) => {
                const check = document.createElement('div');
                check.className = 'radio-check';
                check.textContent = PhoneOS.state.settings[key] === opt ? '✓' : '';
                return ui.row({
                    text: cap(opt),
                    control: check,
                    onTap: () => {
                        PhoneOS.state.settings[key] = opt;
                        PhoneOS.sounds.preview(key, opt);
                        soundsScreen(view);
                        save();
                    },
                });
            })));
        };

        pickerGroup('Ringtone', RINGTONES, 'ringtone');
        pickerGroup('Text Tone', TEXTTONES, 'texttone');
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'settings', name: 'Settings', dock: true,
        iconBg: 'linear-gradient(135deg,#8e8e93,#58585c)',
        glyph: PhoneOS.glyphs.settings,
        render: mainScreen,
    });
})();
