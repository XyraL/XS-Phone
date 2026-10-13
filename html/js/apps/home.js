(() => {
    const ui = PhoneOS.ui;
    const LOCK = '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3zm0 9.5a1.75 1.75 0 0 0-1 3.2V18h2v-1.3a1.75 1.75 0 0 0-1-3.2z"/></svg>';
    const UNLOCK = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 5 5v2h-2V7a3 3 0 0 0-6 0v3h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h8V7a5 5 0 0 1 5-5zm-7 11.5a1.75 1.75 0 0 0-1 3.2V18h2v-1.3a1.75 1.75 0 0 0-1-3.2z"/></svg>';
    const BELL = '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z"/></svg>';
    const KEY = '<svg viewBox="0 0 24 24"><path d="M7.5 9a5.5 5.5 0 0 1 10.6-2H22v3h-1.6v2.5h-3V10h-.9A5.5 5.5 0 1 1 7.5 9zm5.5 0a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z" transform="translate(-2 3)"/></svg>';

    let homes = [];
    let currentId = null;
    let viewEl = null;

    const ERRORS = {
        offline: 'They need to be in the city to get a key.',
        invalid_number: 'That number isn’t in service.',
        already: 'They already have a key.',
        full: 'This place has as many keys as it can.',
        not_owner: 'Only the owner can do that.',
        unsupported: 'This property doesn’t support that.',
        gone: 'That’s no longer available.',
        rate_limited: 'Slow down a little.',
    };

    async function load() {
        const res = await PhoneOS.api('home:list');
        homes = (res && res.ok && res.data && res.data.homes) || [];
        return res;
    }

    function lockButton(h, big, onDone) {
        const b = document.createElement('button');
        b.className = 'hm-lock' + (big ? ' big' : '') + (h.locked ? ' locked' : ' open');
        b.innerHTML = h.locked ? LOCK : UNLOCK;
        const label = document.createElement('span');
        label.textContent = h.locked ? 'Locked' : 'Unlocked';
        b.append(label);
        b.addEventListener('click', async (e) => {
            e.stopPropagation();
            b.disabled = true;
            const res = await PhoneOS.api('home:lock', { id: h.id, locked: !h.locked });
            b.disabled = false;
            if (res && res.ok) {
                h.locked = res.data.locked;
                PhoneOS.sounds.tick();
                onDone();
            } else {
                PhoneOS.notify({ app: 'home', title: 'Home', body: ERRORS[res && res.error] || 'The lock didn’t respond.' });
            }
        });
        return b;
    }

    function tile(view, h) {
        const card = document.createElement('div');
        card.className = 'hm-tile';
        const icon = document.createElement('div');
        icon.className = 'hm-icon';
        icon.innerHTML = PhoneOS.glyphs.home;
        const info = document.createElement('div');
        info.className = 'hm-info';
        const name = document.createElement('div');
        name.className = 'hm-name';
        name.textContent = h.label;
        const sub = document.createElement('div');
        sub.className = 'hm-sub';
        const ringNote = h.rings && h.rings.length ? ' · rang ' + ui.fmtWhen(h.rings[0].at) : '';
        sub.textContent = (h.owner ? 'Owner' : 'Key holder') + ringNote;
        info.append(name, sub);
        card.append(icon, info);
        if (h.canLock) card.append(lockButton(h, false, () => list(view)));
        card.addEventListener('click', () => detail(view, h.id));
        return card;
    }

    async function list(view) {
        currentId = null;
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('Home'));
        const skel = ui.skeleton(3);
        view.append(skel);
        const res = await load();
        if (!fresh()) return;
        skel.remove();
        const content = ui.content();
        if (!res || !res.ok) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Home isn’t set up on this server.';
            content.append(empty);
        } else if (!homes.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'You don’t own or have keys to anywhere yet.';
            content.append(empty);
        } else {
            const mine = homes.filter((h) => h.owner);
            const keyed = homes.filter((h) => !h.owner);
            if (mine.length) {
                content.append(ui.label('My places'));
                for (const h of mine) content.append(tile(view, h));
            }
            if (keyed.length) {
                content.append(ui.label('Shared with me'));
                for (const h of keyed) content.append(tile(view, h));
            }
        }
        view.append(content);
    }

    async function detail(view, id, reload) {
        currentId = id;
        const fresh = PhoneOS.freshRender(view);
        if (reload) await load();
        if (!fresh()) return;
        const h = homes.find((x) => x.id === id);
        if (!h) { list(view); return; }
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Home', onTap: () => list(view) } }));
        const content = ui.content();

        const hero = document.createElement('div');
        hero.className = 'hm-hero';
        const title = document.createElement('div');
        title.className = 'hm-title';
        title.textContent = h.label;
        const role = document.createElement('div');
        role.className = 'hm-role';
        role.textContent = h.owner ? 'You own this place' : 'You have a key';
        hero.append(title, role);
        if (h.canLock) {
            hero.append(lockButton(h, true, () => detail(view, id)));
        } else {
            const note = document.createElement('div');
            note.className = 'hm-nolock';
            note.textContent = 'This place locks at the door, not from your phone.';
            hero.append(note);
        }
        content.append(hero);

        if (typeof h.x === 'number' && typeof h.y === 'number') {
            const gps = document.createElement('button');
            gps.className = 'primary-btn hm-gps';
            gps.textContent = 'Set GPS';
            gps.addEventListener('click', async () => {
                const res = await PhoneOS.nui('setWaypoint', { x: h.x, y: h.y });
                if (res && res.ok) gps.textContent = 'GPS Set';
            });
            content.append(gps);
        }

        content.append(ui.label('Doorbell'));
        if (!h.rings || !h.rings.length) {
            const quiet = document.createElement('div');
            quiet.className = 'hm-quiet';
            quiet.textContent = 'Nobody has rung lately.';
            content.append(quiet);
        } else {
            content.append(ui.group(h.rings.map((r) => {
                const ic = document.createElement('div');
                ic.className = 'hm-row-ic bell';
                ic.innerHTML = BELL;
                let control;
                if (r.canLetIn) {
                    control = document.createElement('button');
                    control.className = 'hm-letin';
                    control.textContent = 'Let In';
                    control.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        control.disabled = true;
                        const res = await PhoneOS.api('home:letIn', { id: h.id, ring: r.i });
                        if (res && res.ok) control.textContent = 'Opened';
                        else { control.disabled = false; PhoneOS.notify({ app: 'home', title: 'Home', body: ERRORS[res && res.error] || 'Couldn’t open the door.' }); }
                    });
                }
                return ui.row({ icon: ic, text: r.name, value: ui.fmtWhen(r.at), control });
            })));
        }

        if (h.owner && h.canKeys) {
            content.append(ui.label('Keys'));
            const rows = h.keys.map((k) => {
                const r = ui.row({ text: k.name, control: (() => {
                    const rm = document.createElement('button');
                    rm.className = 'hm-remove';
                    rm.textContent = 'Remove';
                    rm.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (!await ui.confirm(view, `Take ${k.name}'s key to ${h.label}?`, 'Remove Key')) return;
                        const res = await PhoneOS.api('home:removeKey', { id: h.id, cid: k.cid });
                        if (res && res.ok) setTimeout(() => detail(view, id, true), 600);
                        else PhoneOS.notify({ app: 'home', title: 'Home', body: ERRORS[res && res.error] || 'Couldn’t remove the key.' });
                    });
                    return rm;
                })() });
                r.prepend(ui.avatar(k.name, 30));
                return r;
            });
            const give = document.createElement('div');
            give.className = 'hm-row-ic key';
            give.innerHTML = KEY;
            const add = ui.row({ icon: give, text: 'Give a Key', chevron: true, onTap: () => giveSheet(view, h) });
            add.classList.add('hm-give');
            content.append(ui.group([...rows, add]));
        }
        view.append(content);
    }

    async function giveSheet(view, h) {
        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet';
        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = 'Give a key to ' + h.label;
        sheet.append(title);

        const give = async (number) => {
            overlay.remove();
            const res = await PhoneOS.api('home:giveKey', { id: h.id, to: number });
            if (res && res.ok) {
                PhoneOS.notify({ app: 'home', title: 'Home', body: 'Key sent.' });
                setTimeout(() => detail(view, h.id, true), 600);
            } else {
                PhoneOS.notify({ app: 'home', title: 'Home', body: ERRORS[res && res.error] || 'Couldn’t give the key.' });
            }
        };
        const dial = document.createElement('div');
        dial.className = 'picker-url-row';
        const input = ui.textInput({ placeholder: 'Enter a number…' });
        input.inputMode = 'tel';
        const go = document.createElement('button');
        go.className = 'chat-send ready';
        go.textContent = '›';
        go.addEventListener('click', () => { const n = input.value.trim(); if (n) give(n); });
        dial.append(input, go);
        sheet.append(dial);
        if (contacts.length) {
            sheet.append(ui.group(contacts.map((c) => {
                const r = ui.row({ text: c.name, value: c.number, onTap: () => give(c.number) });
                r.prepend(ui.avatar(c.name, 30, c.avatar || null));
                return r;
            })));
        }
        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());
        sheet.append(cancel);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        view.append(overlay);
    }

    PhoneOS.on('phone:homeChanged', () => {
        const cur = PhoneOS.router.current();
        if (!viewEl || !document.body.contains(viewEl) || !cur || cur.id !== 'home') return;
        if (currentId) detail(viewEl, currentId, true); else list(viewEl);
    });

    PhoneOS.registerApp({
        id: 'home', name: 'Home', requires: 'home',
        iconBg: 'linear-gradient(135deg,#ffcf5c,#ff9500)',
        glyph: PhoneOS.glyphs.home,
        render: (view) => { viewEl = view; list(view); },
    });
})();
