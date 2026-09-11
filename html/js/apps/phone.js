(() => {
    const ui = PhoneOS.ui;
    let activeCall = null;   // { callId, number, phase, answeredAt }
    let timerInterval = null;
    let overlay = null;

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
        ensureOverlay().classList.add('hidden');
    }

    function dur(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m + ':' + String(s).padStart(2, '0');
    }

    // While a call is up the island carries it, so leaving the call screen
    // still shows who you are on with and for how long — tap to go back.
    function islandForCall() {
        if (!activeCall) return null;
        const name = PhoneOS.resolveName(activeCall.number);
        const sub = activeCall.phase === 'active' && activeCall.answeredAt
            ? dur(Math.max(0, Math.floor((Date.now() - activeCall.answeredAt) / 1000)))
            : (activeCall.phase === 'incoming' ? 'Incoming' : 'Calling…');
        return {
            icon: PhoneOS.glyphs.phone,
            iconBg: 'linear-gradient(135deg,#68de7c,#28bd4c)',
            title: name,
            subtitle: sub,
            onTap: () => { if (activeCall) renderOverlay(); },
        };
    }

    function roundBtn(kind, label, onTap) {
        const wrap = document.createElement('div');
        wrap.className = 'co-btn-wrap';
        const b = document.createElement('button');
        b.className = 'co-btn ' + kind;
        b.innerHTML = PhoneOS.glyphs.phone;
        b.addEventListener('click', onTap);
        const l = document.createElement('div');
        l.className = 'co-btn-label';
        l.textContent = label;
        wrap.append(b, l);
        return wrap;
    }

    function renderOverlay() {
        const el = ensureOverlay();
        el.textContent = '';
        el.classList.remove('hidden');
        if (!activeCall) return;
        PhoneOS.island.show('call', islandForCall);

        const name = PhoneOS.resolveName(activeCall.number);

        const av = ui.avatar(name, 92, PhoneOS.contactAvatar(activeCall.number));
        av.classList.add('co-avatar');
        const title = document.createElement('div');
        title.className = 'co-name';
        title.textContent = name;
        const sub = document.createElement('div');
        sub.className = 'co-sub';

        const actions = document.createElement('div');
        actions.className = 'co-actions';

        const phase = activeCall.phase;
        if (phase === 'outgoing') {
            sub.textContent = 'Calling…';
            actions.append(roundBtn('co-red', 'End', () => {
                PhoneOS.api('calls:hangup', { callId: activeCall.callId });
            }));
        } else if (phase === 'incoming') {
            sub.textContent = 'Incoming call';
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
                sub.textContent = ui.fmtDuration(
                    Math.max(0, Math.floor((Date.now() - activeCall.answeredAt) / 1000)));
            };
            paintTimer();
            stopTimer();
            timerInterval = setInterval(paintTimer, 1000);

            const mute = roundBtn('co-grey', 'Mute', () => {
                activeCall.muted = !activeCall.muted;
                PhoneOS.nui('callMute', { muted: activeCall.muted });
                mute.querySelector('.co-btn').classList.toggle('co-muted', activeCall.muted);
                mute.querySelector('.co-btn-label').textContent =
                    activeCall.muted ? 'Unmute' : 'Mute';
            });
            if (activeCall.muted) {
                mute.querySelector('.co-btn').classList.add('co-muted');
                mute.querySelector('.co-btn-label').textContent = 'Unmute';
            }

            const speaker = roundBtn('co-grey', 'Speaker', () => {
                activeCall.speaker = !activeCall.speaker;
                speaker.querySelector('.co-btn').classList.toggle('co-muted', activeCall.speaker);
            });
            if (activeCall.speaker) speaker.querySelector('.co-btn').classList.add('co-muted');

            actions.append(mute, speaker, roundBtn('co-red', 'End', () => {
                PhoneOS.api('calls:hangup', { callId: activeCall.callId });
            }));
        } else if (phase === 'ended') {
            if (activeCall.muted) PhoneOS.nui('callMute', { muted: false });
            sub.textContent = activeCall.reasonText || 'Call ended';
            setTimeout(hideOverlay, 1600);
        }

        el.append(av, title, sub, actions);
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

    async function startCall(number) {
        if (activeCall) return;
        number = String(number || '').trim();
        if (!number) return;
        if (PhoneOS.state.settings.airplane) {
            PhoneOS.notify({ app: 'settings', title: 'Airplane Mode', body: 'Turn it off to place calls.' });
            return;
        }

        activeCall = { callId: null, number, phase: 'outgoing' };
        renderOverlay();

        const res = await PhoneOS.api('calls:start', { to: number });
        if (!res || !res.ok) {
            if (activeCall) {
                activeCall.phase = 'ended';
                activeCall.reasonText = START_ERRORS[res && res.error] || 'Call failed';
                renderOverlay();
            }
            return;
        }
        if (activeCall) activeCall.callId = res.data.callId;
    }
    PhoneOS.startCall = startCall; // contacts app's Call button uses this

    PhoneOS.on('phone:callState', (data) => {
        if (data.phase === 'incoming') {
            activeCall = { callId: data.callId, number: data.number, phase: 'incoming' };
            if (!(PhoneOS.state && PhoneOS.state.settings.dnd)) {
                PhoneOS.sounds.startRing(PhoneOS.state && PhoneOS.state.settings.ringtone);
            }
            renderOverlay();
            return;
        }
        if (!activeCall || (data.callId && activeCall.callId && data.callId !== activeCall.callId)) return;

        if (data.phase === 'active') {
            PhoneOS.sounds.stopRing();
            activeCall.phase = 'active';
            activeCall.answeredAt = Date.now();
            renderOverlay();
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
