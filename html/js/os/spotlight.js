PhoneOS.spotlight = (() => {
    let el = null;

    function appRow(def) {
        const r = document.createElement('button');
        r.type = 'button';
        r.className = 'sp-row';
        const ic = document.createElement('div');
        ic.className = 'sp-ic';
        ic.style.background = def.iconBg;
        ic.innerHTML = def.glyph;
        const nm = document.createElement('div');
        nm.className = 'sp-name';
        nm.textContent = PhoneOS.appName(def.id);
        const kind = document.createElement('div');
        kind.className = 'sp-kind';
        kind.textContent = 'App';
        r.append(ic, nm, kind);
        r.addEventListener('click', () => { hide(); PhoneOS.router.openApp(def.id); });
        return r;
    }

    function contactRow(c) {
        const r = document.createElement('button');
        r.type = 'button';
        r.className = 'sp-row';
        r.append(PhoneOS.ui.avatar(c.name, 34, c.avatar || null));
        const nm = document.createElement('div');
        nm.className = 'sp-name';
        nm.textContent = c.name;
        const kind = document.createElement('div');
        kind.className = 'sp-kind';
        kind.textContent = c.number;
        r.append(nm, kind);
        r.addEventListener('click', () => {
            hide();
            PhoneOS.router.openApp('messages', null, { composeTo: c.number });
        });
        return r;
    }

    async function results(q, box) {
        box.textContent = '';
        const term = q.trim().toLowerCase();
        if (!term) {
            const hint = document.createElement('div');
            hint.className = 'sp-hint';
            hint.textContent = 'Search apps and contacts';
            box.append(hint);
            return;
        }

        const installed = (PhoneOS.state && PhoneOS.state.installedApps) || [];
        const apps = PhoneOS.apps.filter((a) => {
            if (a.store && !installed.includes(a.id)) return false;
            return PhoneOS.appName(a.id).toLowerCase().includes(term);
        }).slice(0, 5);

        const contacts = (await PhoneOS.loadContacts() || []).filter((c) =>
            c.name.toLowerCase().includes(term) || c.number.includes(term)).slice(0, 5);

        if (!apps.length && !contacts.length) {
            const none = document.createElement('div');
            none.className = 'sp-hint';
            none.textContent = 'No results';
            box.append(none);
            return;
        }
        for (const a of apps) box.append(appRow(a));
        for (const c of contacts) box.append(contactRow(c));
    }

    function show() {
        if (el || !PhoneOS.state) return;
        el = document.createElement('div');
        el.className = 'sp-overlay';

        const bar = document.createElement('div');
        bar.className = 'sp-bar';
        const input = document.createElement('input');
        input.className = 'sp-input';
        input.type = 'text';
        input.placeholder = 'Search';
        input.autocomplete = 'off';
        bar.append(input);

        const box = document.createElement('div');
        box.className = 'sp-results';

        el.append(bar, box);
        el.addEventListener('click', (e) => { if (e.target === el) hide(); });
        document.getElementById('phone-screen').append(el);

        results('', box);
        input.addEventListener('input', () => results(input.value, box));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); hide(); return; }
            if (e.key === 'Enter') {
                const first = box.querySelector('.sp-row');
                if (first) first.click();
            }
        });

        void el.offsetWidth;
        el.classList.add('in');
        setTimeout(() => input.focus(), 60);
    }

    function hide() {
        if (!el) return;
        const dead = el;
        el = null;
        dead.classList.remove('in');
        setTimeout(() => dead.remove(), 200);
    }

    PhoneOS.on('phone:close', hide);

    return { show, hide, isOpen: () => !!el };
})();
