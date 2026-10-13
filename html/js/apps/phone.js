(() => {
    const ui = PhoneOS.ui;
    let activeCall = null;
    let timerInterval = null;
    let noticeTimer = null;
    let overlay = null;

    const ICONS = {
        mute: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.3-3a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9h-1.7z"/><path d="M3.3 4.7l1.4-1.4 16 16-1.4 1.4z"/></svg>',
        add: '<svg viewBox="0 0 24 24"><path d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 4v2h14v-2c0-2.3-3.7-4-7-4zm9-6V6h-2v2h-2v2h2v2h2v-2h2V8h-2z"/></svg>',
        speaker: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 5V4L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    };

    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'call-overlay';
        overlay.className = 'hidden';
        document.getElementById('phone-screen').append(overlay);
        return overlay;
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function hideOverlay() {
        stopTimer();
        activeCall = null;
        PhoneOS.island.clear('call');
        document.querySelectorAll('.call-add-sheet').forEach((el) => el.remove());
        ensureOverlay().classList.add('hidden');
    }

    function dur(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m + ':' + String(s).padStart(2, '0');
    }

    function members() {
        return (activeCall && activeCall.members) || [];
    }

    function joinNames(list) {
        const names = list.map((m) => PhoneOS.resolveName(m.number));
        if (names.length <= 1) return names[0] || '';
        if (names.length === 2) return names[0] + ' & ' + names[1];
        if (names.length === 3) return names[0] + ', ' + names[1] + ' & ' + names[2];
        return names[0] + ', ' + names[1] + ' & ' + (names.length - 2) + ' others';
    }

    function callTitle() {
        if (!activeCall) return '';
        const list = members();
        if (activeCall.phase === 'incoming' || !list.length) return PhoneOS.resolveName(activeCall.number);
        return joinNames(list);
    }

    function islandForCall() {
        if (!activeCall) return null;
        const sub = activeCall.phase === 'active' && activeCall.answeredAt
            ? dur(Math.max(0, Math.floor((Date.now() - activeCall.answeredAt) / 1000)))
            : (activeCall.phase === 'incoming' ? 'Incoming' : 'Calling…');
        return {
            icon: PhoneOS.glyphs.phone,
            iconBg: 'linear-gradient(135deg,#68de7c,#28bd4c)',
            title: callTitle(),
            subtitle: sub,
            onTap: () => { if (activeCall) renderOverlay(); },
        };
    }

    function roundBtn(kind, label, onTap, glyph) {
        const wrap = document.createElement('div');
        wrap.className = 'co-btn-wrap';
        const b = document.createElement('button');
        b.className = 'co-btn ' + kind;
        b.innerHTML = glyph || PhoneOS.glyphs.phone;
        b.addEventListener('click', onTap);
        const l = document.createElement('div');
        l.className = 'co-btn-label';
        l.textContent = label;
        wrap.append(b, l);
        return wrap;
    }

    const NOTICES = {
        declined: (name) => name + ' declined',
        no_answer: (name) => name + ' didn’t answer',
        left: (name) => name + ' left the call',
    };

    function flash(text) {
        if (!activeCall || !text) return;
        activeCall.notice = text;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => {
            if (!activeCall) return;
            activeCall.notice = null;
            const el = document.querySelector('#call-overlay .co-notice');
            if (el) el.textContent = '';
        }, 3200);
        const el = document.querySelector('#call-overlay .co-notice');
        if (el) el.textContent = text;
    }

    function avatarStack(list) {
        const stack = document.createElement('div');
        stack.className = 'co-stack';
        for (const m of list.slice(0, 3)) {
            const a = ui.avatar(PhoneOS.resolveName(m.number), 64,
                m.number !== 'Anonymous' ? PhoneOS.contactAvatar(m.number) : null);
            a.classList.add('co-stack-av');
            stack.append(a);
        }
        return stack;
    }

    function memberList(list) {
        const box = document.createElement('div');
        box.className = 'co-members';
        for (const m of list) {
            const row = document.createElement('div');
            row.className = 'co-member' + (m.state === 'ringing' ? ' ringing' : '');
            const name = PhoneOS.resolveName(m.number);
            row.append(ui.avatar(name, 30, m.number !== 'Anonymous' ? PhoneOS.contactAvatar(m.number) : null));
            const label = document.createElement('div');
            label.className = 'co-member-name';
            label.textContent = name;
            const state = document.createElement('div');
            state.className = 'co-member-state';
            state.textContent = m.state === 'ringing' ? 'Calling…' : '';
            row.append(label, state);
            box.append(row);
        }
        return box;
    }

    const ADD_ERRORS = {
        full: 'The call is full',
        busy: 'They’re on another call',
        already_in: 'They’re already on the call',
        no_answer: 'They can’t be reached',
        invalid_number: 'Number not in service',
        not_active: 'Wait for them to pick up first',
        rate_limited: 'Try again in a moment',
    };

    async function addToCall(number) {
        if (!activeCall || !number) return;
        const res = await PhoneOS.api('calls:add', { callId: activeCall.callId, to: number });
        if (!res || !res.ok) flash(ADD_ERRORS[res && res.error] || 'Couldn’t add them');
    }

    async function addSheet() {
        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        if (!activeCall) return;
        const inCall = new Set(members().map((m) => m.number));

        const sheetOverlay = document.createElement('div');
        sheetOverlay.className = 'picker-overlay call-add-sheet';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet';
        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = 'Add to call';
        sheet.append(title);

        const close = () => sheetOverlay.remove();
        const dialRow = document.createElement('div');
        dialRow.className = 'picker-url-row';
        const input = ui.textInput({ placeholder: 'Enter a number…' });
        input.inputMode = 'tel';
        const go = document.createElement('button');
        go.className = 'chat-send ready';
        go.textContent = '›';
        go.addEventListener('click', () => {
            const n = input.value.trim();
            if (!n) return;
            close();
            addToCall(n);
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
        dialRow.append(input, go);
        sheet.append(dialRow);

        const pickable = contacts.filter((c) => !inCall.has(c.number));
        if (pickable.length) {
            sheet.append(ui.group(pickable.map((c) => {
                const r = ui.row({ text: c.name, value: c.number, onTap: () => { close(); addToCall(c.number); } });
                r.prepend(ui.avatar(c.name, 30, c.avatar || null));
                return r;
            })));
        }

        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', close);
        sheet.append(cancel);

        sheetOverlay.append(sheet);
        sheetOverlay.addEventListener('click', (e) => { if (e.target === sheetOverlay) close(); });
        document.getElementById('phone-screen').append(sheetOverlay);
    }

    function renderOverlay() {
        const el = ensureOverlay();
        el.textContent = '';
        el.classList.remove('hidden');
        if (!activeCall) return;
        PhoneOS.island.show('call', islandForCall);

        const phase = activeCall.phase;
        const list = members();
        const group = phase !== 'incoming' && list.length > 1;
        el.classList.toggle('co-group', group);

        let face;
        if (group) {
            face = avatarStack(list);
        } else {
            const number = phase === 'incoming' || !list.length ? activeCall.number : list[0].number;
            face = ui.avatar(PhoneOS.resolveName(number), 92,
                number !== 'Anonymous' ? PhoneOS.contactAvatar(number) : null);
            face.classList.add('co-avatar');
        }

        const title = document.createElement('div');
        title.className = 'co-name';
        title.textContent = callTitle();
        const sub = document.createElement('div');
        sub.className = 'co-sub';
        el.append(face, title, sub);

        if (phase === 'incoming' && list.length > 1) {
            const withLine = document.createElement('div');
            withLine.className = 'co-with';
            withLine.textContent = 'with ' + joinNames(list.filter((m) => m.number !== activeCall.number));
            el.append(withLine);
        }
        if (group) el.append(memberList(list));
        if (phase === 'active' && (activeCall.line || activeCall.asLine)) {
            el.append(Object.assign(document.createElement('div'), {
                className: 'co-with', textContent: activeCall.line ? `On the ${activeCall.line} line` : `Calling as ${activeCall.asLine}`,
            }));
        }

        const notice = document.createElement('div');
        notice.className = 'co-notice';
        notice.textContent = activeCall.notice || '';
        el.append(notice);

        const actions = document.createElement('div');
        actions.className = 'co-actions';

        if (phase === 'outgoing') {
            sub.textContent = activeCall.asLine ? `Calling as ${activeCall.asLine}…` : 'Calling…';
            actions.append(roundBtn('co-red', 'End', () => {
                PhoneOS.api('calls:hangup', { callId: activeCall.callId });
            }));
        } else if (phase === 'incoming') {
            sub.textContent = activeCall.line ? `${activeCall.line} call`
                : (list.length > 1 ? 'Invites you to a group call' : 'Incoming call');
            if (activeCall.line) sub.classList.add('co-line');
            actions.append(
                roundBtn('co-red', 'Decline', () => {
                    PhoneOS.api('calls:decline', { callId: activeCall.callId });
                }),
                roundBtn('co-green', 'Accept', () => {
                    PhoneOS.api('calls:answer', { callId: activeCall.callId });
                }),
            );
        } else if (phase === 'active') {
            const paintTimer = () => {
                if (!activeCall || !activeCall.answeredAt) return;
                sub.textContent = ui.fmtDuration(
                    Math.max(0, Math.floor((Date.now() - activeCall.answeredAt) / 1000)));
            };
            paintTimer();
            stopTimer();
            timerInterval = setInterval(paintTimer, 1000);

            const grid = document.createElement('div');
            grid.className = 'co-grid';

            const mute = roundBtn('co-grey', activeCall.muted ? 'Unmute' : 'Mute', () => {
                activeCall.muted = !activeCall.muted;
                PhoneOS.nui('callMute', { muted: activeCall.muted });
                mute.querySelector('.co-btn').classList.toggle('co-muted', activeCall.muted);
                mute.querySelector('.co-btn-label').textContent = activeCall.muted ? 'Unmute' : 'Mute';
            }, ICONS.mute);
            if (activeCall.muted) mute.querySelector('.co-btn').classList.add('co-muted');

            const add = roundBtn('co-grey', 'Add', () => addSheet(), ICONS.add);

            const speaker = roundBtn('co-grey', 'Speaker', () => {
                activeCall.speaker = !activeCall.speaker;
                speaker.querySelector('.co-btn').classList.toggle('co-muted', activeCall.speaker);
            }, ICONS.speaker);
            if (activeCall.speaker) speaker.querySelector('.co-btn').classList.add('co-muted');

            grid.append(mute, add, speaker);
            el.append(grid);
            actions.append(roundBtn('co-red', 'End', () => {
                PhoneOS.api('calls:hangup', { callId: activeCall.callId });
            }));
        } else if (phase === 'ended') {
            if (activeCall.muted) PhoneOS.nui('callMute', { muted: false });
            sub.textContent = activeCall.reasonText || 'Call ended';
            const ended = activeCall;
            document.querySelectorAll('.call-add-sheet').forEach((s) => s.remove());
            setTimeout(() => { if (activeCall === ended) hideOverlay(); }, 1600);
        }

        el.append(actions);
    }

    const END_REASONS = {
        no_answer: 'No answer',
        declined: 'Call declined',
        cancelled: 'Call ended',
        hangup: 'Call ended',
    };
    const START_ERRORS = {
        no_answer: 'No answer',
        busy_self: 'You\'re already in a call',
        invalid_number: 'Number not in service',
        airplane: 'Airplane Mode is on',
        rate_limited: 'Try again in a moment',
    };

    async function startCall(number, opts) {
        if (activeCall) return;
        const asLine = opts && opts.asLine ? String(opts.asLine) : null;
        number = String(number || '').trim();
        if (!number) return;
        if (PhoneOS.state.settings.airplane) {
            PhoneOS.notify({ app: 'settings', title: 'Airplane Mode', body: 'Turn it off to place calls.' });
            return;
        }

        activeCall = { callId: null, number, phase: 'outgoing', members: [], asLine };
        renderOverlay();

        const res = await PhoneOS.api('calls:start', asLine ? { to: number, asLine } : { to: number });
        if (!res || !res.ok) {
            if (activeCall) {
                activeCall.phase = 'ended';
                activeCall.reasonText = START_ERRORS[res && res.error] || 'Call failed';
                renderOverlay();
            }
            return;
        }
        if (activeCall && !activeCall.callId) activeCall.callId = res.data.callId;
    }
    PhoneOS.startCall = startCall;

    PhoneOS.on('phone:callState', (data) => {
        if (data.phase === 'incoming') {
            if (data.photo && data.number) PhoneOS.photos[data.number] = data.photo;
            activeCall = { callId: data.callId, number: data.number, phase: 'incoming', members: data.members || [], line: data.line || null };
            if (!(PhoneOS.state && PhoneOS.state.settings.dnd)) {
                PhoneOS.sounds.startRing(PhoneOS.state && PhoneOS.state.settings.ringtone);
            }
            renderOverlay();
            if (!PhoneOS.data.contacts) {
                const id = activeCall.callId;
                PhoneOS.loadContacts().then(() => {
                    if (!activeCall || activeCall.callId !== id) return;
                    const el = document.getElementById('call-overlay');
                    if (el && !el.classList.contains('hidden')) renderOverlay();
                    else PhoneOS.island.show('call', islandForCall);
                });
            }
            return;
        }
        if (!activeCall || (data.callId && activeCall.callId && data.callId !== activeCall.callId)) return;
        if (data.callId && !activeCall.callId) activeCall.callId = data.callId;

        if (data.phase === 'active') {
            PhoneOS.sounds.stopRing();
            if (activeCall.phase !== 'active') {
                activeCall.phase = 'active';
                activeCall.answeredAt = Date.now();
            }
            if (data.members) activeCall.members = data.members;
            renderOverlay();
            if (data.notice && NOTICES[data.notice.reason]) {
                flash(NOTICES[data.notice.reason](PhoneOS.resolveName(data.notice.number)));
            }
        } else if (data.phase === 'ended') {
            PhoneOS.sounds.stopRing();
            stopTimer();
            activeCall.phase = 'ended';
            activeCall.reasonText = END_REASONS[data.reason] || 'Call ended';
            renderOverlay();
        }
    });

    let currentTab = 'keypad';

    function tabBar(view) {
        const bar = document.createElement('div');
        bar.className = 'phone-tabbar';
        for (const [id, glyph, labelText] of [
            ['recents', PhoneOS.glyphs.clock, 'Recents'],
            ['keypad', PhoneOS.glyphs.keypad, 'Keypad'],
            ['contacts', PhoneOS.glyphs.contacts, 'Contacts'],
        ]) {
            const t = document.createElement('div');
            t.className = 'phone-tab' + (currentTab === id ? ' selected' : '');
            const icon = document.createElement('div');
            icon.className = 'pt-icon';
            icon.innerHTML = glyph;
            const l = document.createElement('div');
            l.className = 'pt-label';
            l.textContent = labelText;
            t.append(icon, l);
            t.addEventListener('click', () => {
                currentTab = id;
                render(view);
            });
            bar.append(t);
        }
        return bar;
    }

    function keypadScreen(view) {
        const content = document.createElement('div');
        content.className = 'keypad-wrap';

        const display = document.createElement('div');
        display.className = 'keypad-display';
        let dialed = '';
        const paint = () => { display.textContent = dialed || ' '; };
        paint();

        const grid = document.createElement('div');
        grid.className = 'keypad-grid';
        const KEYS = [
            ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
            ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
            ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
            ['*', ''], ['0', '+'], ['#', ''],
        ];
        for (const [digit, letters] of KEYS) {
            const k = document.createElement('button');
            k.className = 'keypad-key';
            const d = document.createElement('div');
            d.className = 'kk-digit';
            d.textContent = digit;
            const l = document.createElement('div');
            l.className = 'kk-letters';
            l.textContent = letters;
            k.append(d, l);
            k.addEventListener('click', () => {
                PhoneOS.sounds.tick();
                if (dialed.length < 16) { dialed += digit; paint(); }
            });
            grid.append(k);
        }

        const row = document.createElement('div');
        row.className = 'keypad-actions';
        const call = document.createElement('button');
        call.className = 'co-btn co-green keypad-call';
        call.innerHTML = PhoneOS.glyphs.phone;
        call.addEventListener('click', () => startCall(dialed));
        const back = document.createElement('button');
        back.className = 'keypad-back';
        back.textContent = '⌫';
        back.addEventListener('click', () => { dialed = dialed.slice(0, -1); paint(); });
        row.append(document.createElement('div'), call, back);

        content.append(display, grid, row);
        return content;
    }

    async function recentsScreen(view) {
        const content = ui.content();
        await PhoneOS.loadContacts();
        const res = await PhoneOS.api('calls:history');
        const rows = (res && res.ok && res.data) || [];
        await PhoneOS.loadPhotos(rows.map((r) => r.number));

        if (!rows.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No recent calls.';
            content.append(empty);
            return content;
        }

        content.append(ui.group(rows.map((r) => {
            const missed = r.state === 'missed' || r.state === 'declined';
            const el = document.createElement('div');
            el.className = 'recent-row';

            const av = ui.avatar(PhoneOS.resolveName(r.number), 40,
                r.number !== 'Anonymous' ? PhoneOS.contactAvatar(r.number) : null);

            const dir = document.createElement('div');
            dir.className = 'rr-dir ' + (missed ? 'rr-missed' : '');
            dir.textContent = r.direction === 'out' ? '↗' : '↙';

            const info = document.createElement('div');
            info.className = 'rr-info';
            const name = document.createElement('div');
            name.className = 'rr-name' + (missed && r.direction === 'in' ? ' rr-missed' : '');
            name.textContent = PhoneOS.resolveName(r.number);
            const sub = document.createElement('div');
            sub.className = 'rr-sub';
            sub.textContent = r.state === 'completed'
                ? ui.fmtDuration(r.duration)
                : (r.state === 'declined' ? 'Declined' : (r.direction === 'in' ? 'Missed' : 'No answer'));
            info.append(name, sub);

            const when = document.createElement('div');
            when.className = 'rr-when';
            when.textContent = ui.fmtWhen(r.at);

            el.append(av, dir, info, when);
            if (r.number !== 'Anonymous') {
                el.addEventListener('click', () => startCall(r.number));
            }
            return el;
        })));
        return content;
    }

    async function contactsScreen(view) {
        const content = ui.content();
        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);

        if (!contacts.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No contacts yet.';
            content.append(empty);
            return content;
        }

        const rowFor = (c) => {
            const r = ui.row({ text: c.name, value: c.number, onTap: () => startCall(c.number) });
            r.prepend(ui.avatar(c.name, 30));
            return r;
        };

        const favs = contacts.filter((c) => c.favorite);
        if (favs.length) {
            content.append(ui.label('Favorites'));
            content.append(ui.group(favs.map(rowFor)));
        }
        content.append(ui.label('All contacts'));
        content.append(ui.group(contacts.map(rowFor)));
        return content;
    }

    async function render(view, params) {
        if (params && params.tab) currentTab = params.tab;
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('Phone'));

        const body = document.createElement('div');
        body.className = 'phone-body';
        view.append(body, tabBar(view));

        if (currentTab === 'keypad') {
            body.append(keypadScreen(view));
        } else if (currentTab === 'recents') {
            const c = await recentsScreen(view);
            if (!fresh()) return;
            body.append(c);
        } else {
            const c = await contactsScreen(view);
            if (!fresh()) return;
            body.append(c);
        }
    }

    PhoneOS.registerApp({
        id: 'phone', name: 'Phone', dock: true,
        iconBg: 'linear-gradient(135deg,#68de7c,#28bd4c)',
        glyph: PhoneOS.glyphs.phone,
        render,
    });
})();
