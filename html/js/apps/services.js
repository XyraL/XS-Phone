(() => {
    const ui = PhoneOS.ui;
    const G = PhoneOS.geo;
    const GLYPH = {
        call: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
        text: '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.6 6.2-.2 1.1-.8 2.2-1.5 3 1.7-.2 3.3-.9 4.5-1.7 1.1.3 2.2.5 3.4.5 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>',
        gps: '<svg viewBox="0 0 24 24"><path d="M20.5 3.5L3.6 10.7c-.6.3-.5 1.2.1 1.3l7 1.3 1.3 7c.1.7 1 .8 1.3.1l7.2-16.9z"/></svg>',
        edit: '<svg viewBox="0 0 24 24"><path d="M4 17.2V20h2.8l8.3-8.3-2.8-2.8L4 17.2zm13.7-7.6a1 1 0 0 0 0-1.4l-1.9-1.9a1 1 0 0 0-1.4 0l-1.5 1.5 2.8 2.8 1.5-1.5z"/></svg>',
        taxi: '<svg viewBox="0 0 24 24"><path d="M9.6 2.4h4.8a.6.6 0 0 1 .6.6v1.7H9V3a.6.6 0 0 1 .6-.6zM5 11l1.6-4.3A2 2 0 0 1 8.5 5.4h7a2 2 0 0 1 1.9 1.3L19 11a2 2 0 0 1 1.5 1.9v4.6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-.9h-11v.9a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-4.6A2 2 0 0 1 5 11zm2.2-.5h9.6l-1.1-3a.6.6 0 0 0-.6-.4H8.9a.6.6 0 0 0-.6.4l-1.1 3zM7 13a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 7 13zm10 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
    };
    const TAXI_ERRORS = {
        rate_limited: 'Slow down a little.',
        airplane: 'Turn off Airplane Mode first.',
        no_taxi: 'Taxi dispatch is offline.',
        no_phone: 'You need a phone for that.',
        transport: 'Taxi dispatch is offline.',
    };
    const CATEGORY_ICON = { Emergency: 'police', Vehicles: 'car', Transport: 'car', 'Food & Drink': 'food' };

    let current = null;
    let taxiCard = null;

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    const title = () => PhoneOS.appName('services');

    function iconButton(kind, label, onTap, disabled) {
        const b = el('button', 'sv-ibtn ' + kind);
        b.type = 'button';
        b.title = label;
        b.innerHTML = GLYPH[kind];
        b.disabled = !!disabled;
        b.addEventListener('click', (e) => { e.stopPropagation(); onTap(); });
        return b;
    }

    async function gps(biz) {
        const res = await PhoneOS.nui('setWaypoint', { x: biz.x, y: biz.y });
        PhoneOS.notify({ app: 'services', title: title(), body: res && res.ok ? `GPS set to ${biz.label}.` : 'Couldn’t set the GPS.' });
    }

    function actionSheet(biz) {
        const overlay = el('div', 'picker-overlay');
        const sheet = el('div', 'picker-sheet sv-sheet');
        const head = el('div', 'sv-sheet-head');
        head.append(el('div', 'sv-sheet-num', biz.number), el('div', 'sv-sheet-label', biz.label),
            el('div', 'sv-sheet-state ' + (biz.open ? 'on' : 'off'), biz.open ? `${biz.onDuty} on duty` : 'Nobody on duty'));
        sheet.append(head);
        const btn = (text, cls, fn) => {
            const b = el('button', 'confirm-btn ' + cls, text);
            b.addEventListener('click', () => { overlay.remove(); fn(); });
            sheet.append(b);
        };
        btn(`Call ${biz.number}`, 'confirm-primary sv-call', () => PhoneOS.startCall(biz.number));
        btn(`Text ${biz.number}`, '', () => PhoneOS.router.openApp('messages', null, { composeTo: biz.number }));
        if (typeof biz.x === 'number') btn('Set GPS', '', () => gps(biz));
        btn('Cancel', '', () => {});
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('phone-screen').append(overlay);
    }

    function taxiButton(text, cls, onTap) {
        const b = el('button', 'sv-taxi-btn' + (cls ? ' ' + cls : ''), text);
        b.type = 'button';
        b.addEventListener('click', async () => {
            b.disabled = true;
            await onTap();
            b.disabled = false;
        });
        return b;
    }

    async function taxiRun(name) {
        const res = await PhoneOS.api(name);
        if (!res || !res.ok) {
            PhoneOS.notify({ app: 'services', title: 'Taxi', body: TAXI_ERRORS[res && res.error] || (res && res.error) || 'That didn’t work.' });
        }
        if (res && res.data && taxiCard) paintTaxi(taxiCard, res.data);
    }

    function paintTaxi(card, s) {
        s = s || { state: 'none' };
        card.textContent = '';
        card.hidden = !!s.driving;
        const head = el('div', 'sv-taxi-head');
        const ic = el('div', 'sv-taxi-ic');
        ic.innerHTML = GLYPH.taxi;
        const body = el('div', 'sv-taxi-body');
        head.append(ic, body);
        card.append(head);
        const cancel = () => taxiButton('Cancel', 'ghost', () => taxiRun('taxi:cancel'));

        if (s.state === 'waiting') {
            const n = Number(s.drivers || 0);
            body.append(el('div', 'sv-taxi-title', 'Finding you a cab'),
                el('div', 'sv-taxi-sub', `Sent to ${n} driver${n === 1 ? '' : 's'}. Stay where you are.`));
            head.append(el('span', 'sv-taxi-pulse'));
            card.append(cancel());
        } else if (s.state === 'accepted') {
            body.append(el('div', 'sv-taxi-title', `${s.driver || 'A driver'} is on the way`),
                el('div', 'sv-taxi-sub', 'Stay where you are.'));
            if (s.vehicle || s.plate) {
                const meta = el('div', 'sv-taxi-meta');
                if (s.vehicle) meta.append(el('span', 'sv-taxi-chip', s.vehicle));
                if (s.plate) meta.append(el('span', 'sv-taxi-chip plate', s.plate));
                card.append(meta);
            }
            card.append(cancel());
        } else if (s.state === 'riding') {
            body.append(el('div', 'sv-taxi-title', 'On your way'),
                el('div', 'sv-taxi-sub', `With ${s.driver || 'your driver'}. You pay the meter at the end.`));
        } else {
            const free = Number(s.drivers || 0);
            body.append(el('div', 'sv-taxi-title', 'Need a ride?'),
                el('div', 'sv-taxi-sub', free ? `${free} cab${free === 1 ? '' : 's'} free. A driver comes to you.` : 'No cabs free right now.'));
            const call = taxiButton('Call a cab', '', () => taxiRun('taxi:call'));
            if (!free) call.disabled = true;
            card.append(call);
        }
    }

    function emergencyTile(biz) {
        const t = el('button', 'sv-sos ' + (biz.job === 'police' ? 'pd' : 'ems'));
        t.type = 'button';
        const icon = el('div', 'sv-sos-ic');
        icon.innerHTML = G.icon(biz.job === 'police' ? 'police' : 'hospital');
        t.append(icon, el('div', 'sv-sos-num', biz.number), el('div', 'sv-sos-label', biz.label),
            el('div', 'sv-sos-state', biz.open ? `${biz.onDuty} on duty` : 'Nobody on duty'));
        t.addEventListener('click', () => actionSheet(biz));
        return t;
    }

    function bizRow(view, biz) {
        const r = el('div', 'sv-row');
        const ic = el('div', 'sv-row-ic');
        const kind = CATEGORY_ICON[biz.category] || 'work';
        ic.style.background = G.tint(kind);
        ic.innerHTML = G.icon(kind);
        const info = el('div', 'sv-row-info');
        const top = el('div', 'sv-row-top');
        top.append(el('span', 'sv-row-name', biz.label), el('span', 'sv-pill ' + (biz.open ? 'open' : 'closed'), biz.open ? 'Open' : 'Closed'));
        const sub = el('div', 'sv-row-sub', (biz.open ? `${biz.onDuty} working` : 'Nobody on duty') + (biz.number ? ` · ${biz.number}` : ''));
        info.append(top, sub);
        if (biz.announcement) info.append(el('div', 'sv-ann', biz.announcement));
        const actions = el('div', 'sv-row-actions');
        if (biz.number) {
            actions.append(iconButton('call', 'Call', () => PhoneOS.startCall(biz.number), !biz.open));
            actions.append(iconButton('text', 'Text', () => PhoneOS.router.openApp('messages', null, { composeTo: biz.number })));
        }
        if (typeof biz.x === 'number') actions.append(iconButton('gps', 'GPS', () => gps(biz)));
        if (biz.isBoss) actions.append(iconButton('edit', 'Announcement', () => announcementSheet(view, biz)));
        r.append(ic, info, actions);
        return r;
    }

    async function render(view) {
        current = null;
        taxiCard = null;
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header(title()));
        const skel = ui.skeleton(5);
        view.append(skel);
        const res = await PhoneOS.api('city:list');
        if (!fresh()) return;
        skel.remove();
        const entries = (res && res.ok && res.data) || [];
        const lines = (res && res.lines) || [];
        const content = ui.content();

        if (res && res.taxi) {
            taxiCard = el('div', 'sv-taxi');
            paintTaxi(taxiCard, res.taxi);
            content.append(taxiCard);
        }

        if (lines.length) {
            content.append(ui.label('Your line'));
            for (const l of lines) {
                const card = el('button', 'sv-line');
                card.type = 'button';
                const ic = el('div', 'sv-line-ic');
                ic.innerHTML = GLYPH.text;
                const body = el('div', 'sv-line-body');
                body.append(el('div', 'sv-line-title', l.label),
                    el('div', 'sv-line-sub', `${l.number} · on duty · ${l.chats} conversation${l.chats === 1 ? '' : 's'}`));
                card.append(ic, body, el('div', 'row-chevron'));
                card.addEventListener('click', () => lineInbox(view, l));
                content.append(card);
            }
        }

        const sos = entries.filter((e) => e.emergency && e.number);
        if (sos.length) {
            content.append(ui.label('Emergency'));
            const grid = el('div', 'sv-sos-grid');
            for (const e of sos) grid.append(emergencyTile(e));
            content.append(grid);
        }

        const byCategory = {};
        for (const e of entries.filter((x) => !(x.emergency && x.number))) {
            (byCategory[e.category] = byCategory[e.category] || []).push(e);
        }
        for (const [category, list] of Object.entries(byCategory)) {
            content.append(ui.label(category));
            const group = el('div', 'list-group sv-group');
            for (const biz of list) group.append(bizRow(view, biz));
            content.append(group);
        }
        if (!entries.length) content.append(el('div', 'empty-state', 'Nothing listed yet.'));
        view.append(content);
    }

    function preview(t) {
        if (t.lastBody) return t.lastBody;
        if (t.lastLocation) return '📍 Location';
        if (t.lastMedia) return '📷 Photo';
        return 'No messages';
    }

    async function lineInbox(view, line) {
        current = { view, line, threadId: null };
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header(`${line.number}`, { back: { label: 'Back', onTap: () => render(view) } }));
        const content = ui.content();
        content.append(el('div', 'sv-inbox-head', `${line.label} line · everyone on duty sees these`));
        const res = await PhoneOS.api('line:threads', { number: line.number });
        if (!fresh()) return;
        await PhoneOS.loadContacts();
        if (!fresh()) return;
        if (!res || !res.ok) {
            content.append(el('div', 'empty-state', res && res.error === 'off_duty' ? 'You need to be on duty to see this line.' : 'Couldn’t load the line.'));
            view.append(content);
            return;
        }
        const threads = res.data.threads || [];
        await PhoneOS.loadPhotos(threads.map((t) => t.caller));
        if (!fresh()) return;
        if (!threads.length) {
            content.append(el('div', 'empty-state', 'No messages on this line yet.'));
        } else {
            const group = el('div', 'list-group');
            for (const t of threads) {
                const row = el('div', 'thread-row sv-thread');
                const name = PhoneOS.resolveName(t.caller || 'Unknown');
                row.append(ui.avatar(name, 42, t.caller ? PhoneOS.contactAvatar(t.caller) : null));
                const info = el('div', 'tr-info');
                const top = el('div', 'tr-top');
                top.append(el('div', 'tr-name', name), el('div', 'tr-when', ui.fmtWhen(t.lastAt) + ' ›'));
                const pv = el('div', 'tr-preview', (t.lastSender === line.number ? 'You: ' : '') + preview(t));
                info.append(top, pv);
                row.append(info);
                row.addEventListener('click', () => lineChat(view, line, t.id, t.caller));
                group.append(row);
            }
            content.append(group);
        }
        view.append(content);
    }

    async function lineChat(view, line, threadId, caller) {
        current = { view, line, threadId };
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        const name = PhoneOS.resolveName(caller || 'Unknown');
        const head = el('div', 'imsg-head');
        const back = el('button', 'ah-back', 'Back');
        back.addEventListener('click', () => lineInbox(view, line));
        const center = el('div', 'imsg-head-center');
        center.append(ui.avatar(name, 40, caller ? PhoneOS.contactAvatar(caller) : null), el('div', 'imsg-head-name', `${name} · via ${line.number}`));
        const call = el('button', 'ah-action sv-callback');
        call.innerHTML = GLYPH.call;
        call.title = `Call back as ${line.number}`;
        call.addEventListener('click', () => {
            if (caller && PhoneOS.startCall) PhoneOS.startCall(caller, { asLine: line.number });
        });
        head.append(back, center, call);
        view.append(head);

        const scroller = el('div', 'chat-scroller');
        const list = el('div', 'chat-list');
        scroller.append(list);
        view.append(scroller);

        const paint = (messages) => {
            list.textContent = '';
            for (const m of messages) {
                const mine = m.sender === line.number;
                const wrap = el('div', 'bubble-wrap ' + (mine ? 'mine' : 'theirs'));
                const b = el('div', 'bubble');
                b.textContent = m.body || (m.location ? '📍 ' + (m.location.label || 'Location') : '');
                wrap.append(b);
                list.append(wrap);
            }
            scroller.scrollTop = scroller.scrollHeight;
        };

        const res = await PhoneOS.api('line:messages', { number: line.number, threadId });
        if (!fresh()) return;
        let messages = (res && res.ok && res.data.messages) || [];
        paint(messages);

        const bar = el('div', 'chat-inputbar');
        const input = ui.textInput({ placeholder: `Reply as ${line.number}` });
        input.classList.add('chat-input');
        const send = el('button', 'chat-send', '↑');
        input.addEventListener('input', () => send.classList.toggle('ready', input.value.trim().length > 0));
        const doSend = async () => {
            const body = input.value.trim();
            if (!body) return;
            send.disabled = true;
            const r = await PhoneOS.api('line:send', { number: line.number, threadId, body });
            send.disabled = false;
            if (!r || !r.ok) {
                PhoneOS.notify({ app: 'services', title: line.label, body: r && r.error === 'off_duty' ? 'You went off duty.' : 'Message failed to send.' });
                return;
            }
            input.value = '';
            send.classList.remove('ready');
            messages = [...messages, r.data];
            paint(messages);
        };
        send.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
        bar.append(input, send);
        view.append(bar);

        lineChat.append = (m) => {
            messages = [...messages, m];
            paint(messages);
        };
    }

    function announcementSheet(view, biz) {
        const overlay = el('div', 'picker-overlay');
        const sheet = el('div', 'picker-sheet');
        sheet.append(el('div', 'picker-title', `${biz.label} announcement`));
        const input = ui.textInput({ placeholder: 'e.g. Half-price repairs until 8pm (blank clears)', value: biz.announcement || '' });
        input.maxLength = 140;
        const save = el('button', 'confirm-btn confirm-primary', 'Publish');
        save.addEventListener('click', async () => {
            const res = await PhoneOS.api('city:setAnnouncement', { text: input.value.trim() });
            overlay.remove();
            if (res && res.ok) render(view);
        });
        const cancel = el('button', 'confirm-btn', 'Cancel');
        cancel.addEventListener('click', () => overlay.remove());
        sheet.append(input, save, cancel);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('phone-screen').append(overlay);
    }

    PhoneOS.on('phone:taxiStatus', (s) => {
        if (taxiCard && document.body.contains(taxiCard)) paintTaxi(taxiCard, s);
    });

    PhoneOS.on('phone:lineMessage', (d) => {
        if (!d || !d.message) return;
        const viewing = current && document.body.contains(current.view) && PhoneOS.isOpen() && current.line.number === d.line;
        if (viewing && current.threadId === d.threadId && lineChat.append) {
            lineChat.append(d.message);
            return;
        }
        if (viewing && current.threadId === null) {
            lineInbox(current.view, current.line);
        }
        if (d.reply) return;
        PhoneOS.notify({
            app: 'services',
            title: `${d.label || d.line} · ${PhoneOS.resolveName(d.message.sender)}`,
            body: d.message.body || (d.message.location ? 'Shared a location' : 'New message'),
        });
    });

    PhoneOS.registerApp({
        id: 'services', name: 'Services',
        iconBg: 'linear-gradient(135deg,#43b5a0,#20826f)',
        glyph: PhoneOS.glyphs.services,
        render,
    });
})();
