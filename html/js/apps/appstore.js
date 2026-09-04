(() => {
    const ui = PhoneOS.ui;

    const META = {
        social:   { tagline: 'Say it to the whole city', category: 'Social' },
        prism:    { tagline: 'Your life in photos', category: 'Social' },
        match:    { tagline: 'Meet someone. Or don\'t.', category: 'Social' },
        darkchat: { tagline: 'No names. No history. No trace.', category: 'Social' },
        market:   { tagline: 'Buy and sell anything', category: 'Lifestyle' },
        music:    { tagline: 'Your playlist, everywhere', category: 'Lifestyle' },
        weather:  { tagline: 'Know before you go', category: 'Lifestyle' },
        game2048: { tagline: 'Slide. Merge. 2048.', category: 'Games' },
        snake:    { tagline: 'Don\'t bite yourself', category: 'Games' },
    };

    function installed() {
        return (PhoneOS.state && PhoneOS.state.installedApps) || [];
    }

    function storeRow(view, def) {
        const row = document.createElement('div');
        row.className = 'store-row';

        const icon = document.createElement('div');
        icon.className = 'app-icon store-icon';
        icon.style.background = def.iconBg;
        icon.innerHTML = def.glyph;

        const info = document.createElement('div');
        info.className = 'store-info';
        const name = document.createElement('div');
        name.className = 'store-name';
        name.textContent = PhoneOS.appName(def.id);
        const tagline = document.createElement('div');
        tagline.className = 'store-tagline';
        tagline.textContent = (META[def.id] || {}).tagline || '';
        info.append(name, tagline);

        const btn = document.createElement('button');
        btn.className = 'store-btn';

        function paint() {
            const isIn = installed().includes(def.id);
            btn.textContent = isIn ? 'OPEN' : 'GET';
            btn.classList.toggle('store-open', isIn);
        }
        paint();

        btn.addEventListener('click', async () => {
            if (installed().includes(def.id)) {
                PhoneOS.router.openApp(def.id);
                return;
            }
            btn.disabled = true;
            btn.textContent = '…';
            await new Promise((r) => setTimeout(r, 1100));
            const res = await PhoneOS.api('store:install', { id: def.id });
            btn.disabled = false;
            if (res && res.ok) {
                PhoneOS.state.installedApps = res.data.installed;
                PhoneOS.rebuildHome();
                PhoneOS.notify({ app: 'appstore', title: 'App Store',
                    body: `${PhoneOS.appName(def.id)} installed.` });
            }
            paint();
        });

        row.append(icon, info, btn);
        return row;
    }

    async function render(view) {
        view.textContent = '';
        view.append(ui.header('App Store'));

        const content = ui.content();
        const storeApps = PhoneOS.apps.filter((a) => a.store);

        const byCategory = {};
        for (const def of storeApps) {
            const cat = (META[def.id] || {}).category || 'Apps';
            (byCategory[cat] = byCategory[cat] || []).push(def);
        }

        for (const [category, defs] of Object.entries(byCategory)) {
            content.append(ui.label(category));
            const group = document.createElement('div');
            group.className = 'list-group';
            for (const def of defs) group.append(storeRow(view, def));
            content.append(group);
        }

        const removable = storeApps.filter((a) => installed().includes(a.id));
        if (removable.length) {
            content.append(ui.label('Installed'));
            content.append(ui.group(removable.map((def) =>
                ui.row({
                    text: PhoneOS.appName(def.id),
                    value: 'Remove',
                    onTap: async () => {
                        if (!await ui.confirm(view,
                            `Remove ${PhoneOS.appName(def.id)} from your phone?`, 'Remove')) return;
                        const res = await PhoneOS.api('store:uninstall', { id: def.id });
                        if (res && res.ok) {
                            PhoneOS.state.installedApps = res.data.installed;
                            PhoneOS.rebuildHome();
                            render(view);
                        }
                    },
                })
            )));
        }
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'appstore', name: 'App Store',
        iconBg: 'linear-gradient(135deg,#31a8ff,#1668dc)',
        glyph: PhoneOS.glyphs.appstore,
        render,
    });
})();
