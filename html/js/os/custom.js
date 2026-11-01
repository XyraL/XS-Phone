(() => {
    const live = new Map();
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const cssUrl = (v) => String(v).replace(/["\\\n\r]/g, '');

    function render(view, def) {
        view.classList.add('custom-app');
        const frame = document.createElement('iframe');
        frame.className = 'custom-frame';
        frame.src = def.ui;
        frame.title = def.name;
        const top = document.createElement('div');
        top.className = 'custom-edge top';
        const bottom = document.createElement('div');
        bottom.className = 'custom-edge bottom';
        view.append(frame, top, bottom);
    }

    function apply(list) {
        const keep = new Set();
        for (const app of Array.isArray(list) ? list : []) {
            if (!app || !app.id || !app.ui) continue;
            if (!live.has(app.id) && PhoneOS.getApp(app.id)) continue;
            keep.add(app.id);
            let def = live.get(app.id);
            if (!def) {
                def = { custom: true };
                def.render = (view) => render(view, def);
                live.set(app.id, def);
                PhoneOS.apps.push(def);
            }
            def.id = app.id;
            def.name = app.name || app.id;
            def.ui = app.ui;
            const base = app.colour || 'linear-gradient(135deg,#636366,#3a3a3c)';
            def.iconBg = app.icon ? `center / cover no-repeat url("${cssUrl(app.icon)}"), ${app.colour || '#1c1c1e'}` : base;
            def.glyph = app.icon ? '' : `<span class="custom-letter">${esc(def.name.charAt(0).toUpperCase())}</span>`;
        }
        for (const [id, def] of live) {
            if (keep.has(id)) continue;
            live.delete(id);
            const at = PhoneOS.apps.indexOf(def);
            if (at >= 0) PhoneOS.apps.splice(at, 1);
            if (PhoneOS.router.current() === def) PhoneOS.router.home();
        }
        if (PhoneOS.state && PhoneOS.rebuildHome) PhoneOS.rebuildHome();
    }

    PhoneOS.on('phone:customApps', apply);
    PhoneOS.on('phone:open', (data) => { if (data && data.customApps) apply(data.customApps); });

    PhoneOS.on('phone:customAppMessage', (msg) => {
        if (!msg || !live.has(msg.id)) return;
        const view = document.querySelector('.app-view.custom-app');
        if (!view || view.dataset.app !== msg.id) return;
        const frame = view.querySelector('iframe');
        if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg.data, '*');
    });

    window.addEventListener('message', (e) => {
        if (e.data !== 'xs-phone:escape' && e.data !== 'xs-phone:home') return;
        const frame = document.querySelector('.app-view.custom-app iframe');
        if (!frame || e.source !== frame.contentWindow) return;
        if (e.data === 'xs-phone:home') {
            PhoneOS.router.home();
        } else if (PhoneOS.IN_GAME) {
            PhoneOS.nui('close');
        }
    });

    PhoneOS.customApps = { apply, ids: () => [...live.keys()] };
})();
