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
        { id: 'xyral',    name: 'XyraL' },
    ];
    const ACCENTS = ['blue', 'teal', 'amber', 'purple', 'green', 'rose'];
    const FINISHES = [
        { id: 'midnight', name: 'Midnight' },
        { id: 'titanium', name: 'Titanium' },
        { id: 'silver',   name: 'Silver' },
        { id: 'gold',     name: 'Gold' },
        { id: 'blue',     name: 'Blue' },
        { id: 'purple',   name: 'Purple' },
        { id: 'red',      name: 'Red' },
        { id: 'green',    name: 'Green' },
        { id: 'pink',     name: 'Pink' },
    ];
    const TEXT_SCALES = [['small', 'Small'], ['default', 'Default'], ['large', 'Large']];
    const RINGTONES = ['horizon', 'classic', 'pulse'];
    const TEXTTONES = ['pop', 'chime', 'ding'];

    PhoneOS.themeOptions = { wallpapers: WALLPAPERS, accents: ACCENTS, finishes: FINISHES };

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
        PhoneOS.shell.applySettings();
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
        const avatar = ui.avatar(s.number || '?', 72, s.photo || null);
        avatar.classList.add('sh-avatar');
        avatar.title = 'Change your photo';
        avatar.addEventListener('click', () => PhoneOS.editMyPhoto(() => mainScreen(view)));
        const edit = document.createElement('div');
        edit.className = 'sh-edit';
        edit.textContent = s.photo ? 'Edit Photo' : 'Add Photo';
        edit.addEventListener('click', () => PhoneOS.editMyPhoto(() => mainScreen(view)));
        const num = document.createElement('div');
        num.className = 'sh-number';
        num.textContent = s.number || 'No number';
        const os = document.createElement('div');
        os.className = 'sh-os';
        os.textContent = `${s.os} · your number`;
        hero.append(avatar, edit, num, os);

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
            ui.label('My Card'),
            ui.group([
                ui.row({ text: 'Shared With', control: segment('photoShare', [['everyone', 'Everyone'], ['contacts', 'Contacts']]) }),
            ]),
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
                ui.row({
                    text: 'Phone Colour',
                    value: (FINISHES.find((f) => f.id === s.settings.frame) || FINISHES[0]).name,
                    chevron: true,
                    onTap: () => finishScreen(view),
                }),
                ui.row({ text: 'Text Size', control: segment('textScale', TEXT_SCALES) }),
            ]),
            ui.label('Personalization'),
            ui.group([
                ui.row({
                    text: 'Wallpaper',
                    value: String(s.settings.wallpaper || '').startsWith('url:') ? 'Photo'
                        : (WALLPAPERS.find((w) => w.id === s.settings.wallpaper)?.name || ''),
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
        footer.textContent = 'XS-Phone by XyraL';
        content.append(footer);

        view.append(content);
    }

    PhoneOS.editMyPhoto = function (onDone) {
        const s = PhoneOS.state;
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet my-photo-sheet';
        const preview = ui.avatar(s.number || '?', 96, s.photo || null);
        preview.classList.add('mp-preview');
        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = 'Your photo';
        const note = document.createElement('div');
        note.className = 'mp-note';
        note.textContent = s.settings.photoShare === 'contacts'
            ? 'Only people in your contacts see this when you call or text them.'
            : 'Everyone you call or text sees this, unless they picked their own photo for you.';
        const error = document.createElement('div');
        error.className = 'form-error';
        const setPhoto = async (url) => {
            const res = await PhoneOS.api('profile:setPhoto', { url });
            if (!res || !res.ok) {
                error.textContent = res && res.error === 'bad_media' ? 'Pick a photo from your gallery.' : 'Couldn’t save your photo.';
                return false;
            }
            s.photo = res.data.photo || null;
            overlay.remove();
            if (onDone) onDone();
            return true;
        };
        const choose = document.createElement('button');
        choose.className = 'confirm-btn confirm-primary';
        choose.textContent = s.photo ? 'Choose New Photo' : 'Choose Photo';
        choose.addEventListener('click', async () => {
            overlay.classList.add('hidden');
            const photo = await PhoneOS.pickPhoto();
            if (!photo) { overlay.classList.remove('hidden'); return; }
            if (!await setPhoto(photo.url)) overlay.classList.remove('hidden');
        });
        sheet.append(preview, title, note, error, choose);
        if (s.photo) {
            const remove = document.createElement('button');
            remove.className = 'confirm-btn confirm-danger';
            remove.textContent = 'Remove Photo';
            remove.addEventListener('click', () => setPhoto(null));
            sheet.append(remove);
        }
        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());
        sheet.append(cancel);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('phone-screen').append(overlay);
    };

    function wallpaperScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Settings', onTap: () => mainScreen(view) } }));

        const content = ui.content();
        content.append(ui.label('Choose a wallpaper'));

        const grid = document.createElement('div');
        grid.className = 'wp-swatches';
        const current = PhoneOS.state.settings.wallpaper || '';
        const photoTile = document.createElement('div');
        photoTile.className = 'wp-swatch wp-photo' + (current.startsWith('url:') ? ' selected' : '');
        if (current.startsWith('url:')) {
            photoTile.style.backgroundImage = `url("${current.slice(4).replace(/"/g, '%22')}")`;
        } else {
            photoTile.innerHTML = PhoneOS.glyphs.gallery;
        }
        const photoName = document.createElement('div');
        photoName.className = 'wp-name';
        photoName.textContent = current.startsWith('url:') ? 'Your Photo' : 'Choose a Photo';
        photoTile.append(photoName);
        photoTile.addEventListener('click', async () => {
            const photo = await PhoneOS.pickPhoto();
            if (!photo) return;
            PhoneOS.state.settings.wallpaper = 'url:' + photo.url;
            PhoneOS.shell.applySettings();
            wallpaperScreen(view);
            save();
        });
        grid.append(photoTile);
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

    function finishScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Settings', onTap: () => mainScreen(view) } }));

        const s = PhoneOS.state.settings;
        const content = ui.content();
        content.append(ui.label('Phone colour'));

        const grid = document.createElement('div');
        grid.className = 'finish-grid';
        for (const f of FINISHES) {
            const sw = document.createElement('div');
            sw.className = 'finish-swatch' + ((s.frame || 'midnight') === f.id ? ' selected' : '');
            const phone = document.createElement('div');
            phone.className = 'finish-phone frame-' + f.id;
            const screen = document.createElement('div');
            screen.className = 'finish-screen';
            if (s.wallpaper && s.wallpaper.startsWith('url:')) {
                screen.style.background = `url("${s.wallpaper.slice(4).replace(/"/g, '%22')}") center/cover`;
            } else {
                screen.classList.add('wp-' + s.wallpaper);
            }
            phone.append(screen);
            const name = document.createElement('div');
            name.className = 'finish-name';
            name.textContent = f.name;
            sw.append(phone, name);
            sw.addEventListener('click', () => {
                s.frame = f.id;
                PhoneOS.shell.applySettings();
                finishScreen(view);
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
