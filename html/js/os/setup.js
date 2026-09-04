PhoneOS.setup = (() => {
    const HELLOS = ['Hello', 'Hola', 'Bonjour', 'Hallo', 'Ciao', 'Olá', 'こんにちは', 'Hej'];

    let overlay = null;
    let helloTimer = null;

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function screen() {
        overlay.textContent = '';
        const box = el('div', 'setup-screen');
        overlay.append(box);
        return box;
    }

    function nextButton(labelText, onTap) {
        const btn = el('button', 'primary-btn setup-next', labelText);
        btn.addEventListener('click', onTap);
        return btn;
    }

    function stepHello() {
        const box = screen();
        box.classList.add('setup-hello');

        const hello = el('div', 'setup-hello-text', HELLOS[0]);
        let i = 0;
        helloTimer = setInterval(() => {
            i = (i + 1) % HELLOS.length;
            hello.classList.remove('in');
            setTimeout(() => {
                hello.textContent = HELLOS[i];
                hello.classList.add('in');
            }, 250);
        }, 1900);
        hello.classList.add('in');

        const hint = el('div', 'setup-hint', 'Tap anywhere to set up your phone');
        box.append(hello, hint);
        box.addEventListener('click', () => {
            clearInterval(helloTimer);
            stepAppearance();
        }, { once: true });
    }

    function stepAppearance() {
        const s = PhoneOS.state.settings;
        const box = screen();
        box.append(el('div', 'setup-title', 'Appearance'));
        box.append(el('div', 'setup-sub', 'Pick a look — you can change it any time in Settings.'));

        const seg = el('div', 'seg-control setup-seg');
        for (const [value, labelText] of [['dark', 'Dark'], ['light', 'Light']]) {
            const opt = el('div', 'seg-option' + (s.theme === value ? ' selected' : ''), labelText);
            opt.addEventListener('click', () => {
                s.theme = value;
                PhoneOS.shell.applySettings();
                [...seg.children].forEach((c) => c.classList.toggle('selected', c === opt));
            });
            seg.append(opt);
        }

        const dots = el('div', 'accent-dots setup-accents');
        for (const id of PhoneOS.themeOptions.accents) {
            const dot = el('div', `accent-dot accent-${id}` + (s.accent === id ? ' selected' : ''));
            dot.addEventListener('click', () => {
                s.accent = id;
                PhoneOS.shell.applySettings();
                [...dots.children].forEach((c) => c.classList.toggle('selected', c === dot));
            });
            dots.append(dot);
        }

        box.append(seg, dots, nextButton('Continue', stepWallpaper));
    }

    function stepWallpaper() {
        const s = PhoneOS.state.settings;
        const box = screen();
        box.append(el('div', 'setup-title', 'Wallpaper'));

        const grid = el('div', 'wp-swatches setup-wallpapers');
        for (const wp of PhoneOS.themeOptions.wallpapers) {
            const sw = el('div', `wp-swatch wp-${wp.id}` + (s.wallpaper === wp.id ? ' selected' : ''));
            sw.append(el('div', 'wp-name', wp.name));
            sw.addEventListener('click', () => {
                s.wallpaper = wp.id;
                PhoneOS.shell.applySettings();
                [...grid.children].forEach((c) => c.classList.toggle('selected', c === sw));
            });
            grid.append(sw);
        }
        box.append(grid, nextButton('Continue', stepPasscode));
    }

    function stepPasscode() {
        const box = screen();
        box.append(el('div', 'setup-title', 'Create a Passcode'));
        box.append(el('div', 'setup-sub', 'It protects your phone if someone takes it. Four digits.'));

        let firstPin = null;
        const padWrap = el('div', 'setup-pad');

        function mountPad(title) {
            padWrap.textContent = '';
            const pad = PhoneOS.ui.pinPad({
                title,
                onComplete: async (pin) => {
                    if (!firstPin) {
                        firstPin = pin;
                        mountPad('Re-enter your passcode');
                        return;
                    }
                    if (pin !== firstPin) {
                        firstPin = null;
                        mountPad('Passcodes didn\'t match — try again');
                        return;
                    }
                    const res = await PhoneOS.api('pin:set', { pin });
                    if (res && res.ok) PhoneOS.state.hasPin = true;
                    stepDone();
                },
            });
            padWrap.append(pad);
        }
        mountPad('Enter a passcode');

        const skip = el('button', 'setup-skip', 'Set up later in Settings');
        skip.addEventListener('click', stepDone);
        box.append(padWrap, skip);
    }

    function stepDone() {
        const box = screen();
        box.classList.add('setup-hello');
        box.append(el('div', 'setup-title', 'You\'re all set'));
        box.append(el('div', 'setup-sub',
            `Your number is ${PhoneOS.state.number}. Grab more apps in the App Store.`));
        box.append(nextButton('Start using your phone', finish));
    }

    async function finish() {
        PhoneOS.state.settings.setupDone = true;
        PhoneOS.nui('saveSettings', PhoneOS.state.settings);
        overlay.remove();
        overlay = null;
        PhoneOS.shell.finishSetup();
    }

    function start() {
        if (overlay) return;
        overlay = el('div', 'setup-overlay');
        document.getElementById('phone-screen').append(overlay);
        stepHello();
    }

    return { start };
})();
