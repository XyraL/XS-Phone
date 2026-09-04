(() => {
    const ui = PhoneOS.ui;
    let activeRoomId = null;
    let appendFn = null;

    const appTitle = () => PhoneOS.appName('darkchat');

    async function roomsScreen(view) {
        activeRoomId = null;
        view.textContent = '';
        view.classList.add('dark-view');
        view.append(ui.header(appTitle(), {
            action: { label: '+', onTap: () => joinScreen(view) },
        }));

        const content = ui.content();
        const res = await PhoneOS.api('darkchat:rooms');
        const rooms = (res && res.ok && res.data) || [];

        if (!rooms.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No rooms. Join one with a code, or create your own.';
            content.append(empty);
        } else {
            content.append(ui.group(rooms.map((r) => {
                const row = ui.row({
                    text: r.name,
                    value: `${r.code} · ${r.members} inside`,
                    chevron: true,
                    onTap: () => roomScreen(view, r),
                });
                row.classList.add('dark-row');
                return row;
            })));
        }
        view.append(content);
    }

    async function roomScreen(view, room) {
        activeRoomId = room.id;
        view.textContent = '';
        view.classList.add('dark-view');

        const head = ui.header('', {
            back: { label: appTitle(), onTap: () => roomsScreen(view) },
            action: { label: 'Leave', onTap: async () => {
                if (await ui.confirm(view, `Leave ${room.name}? The room dies with its last member.`, 'Leave')) {
                    await PhoneOS.api('darkchat:leave', { roomId: room.id });
                    roomsScreen(view);
                }
            } },
        });
        const t = document.createElement('div');
        t.className = 'chat-title';
        t.textContent = `${room.name} · ${room.code}`;
        head.insertBefore(t, head.querySelector('.ah-action'));
        view.append(head);

        const scroller = document.createElement('div');
        scroller.className = 'chat-scroller';
        const list = document.createElement('div');
        list.className = 'chat-list';
        scroller.append(list);
        view.append(scroller);

        const res = await PhoneOS.api('darkchat:messages', { roomId: room.id });
        if (!res || !res.ok) { roomsScreen(view); return; }
        const myHandle = res.data.myHandle;

        function line(m) {
            const el = document.createElement('div');
            el.className = 'dark-line' + (m.handle === myHandle ? ' mine' : '');
            const who = document.createElement('span');
            who.className = 'dark-handle';
            who.textContent = m.handle;
            const body = document.createElement('span');
            body.className = 'dark-body';
            body.textContent = m.body;
            el.append(who, body);
            list.append(el);
        }
        for (const m of res.data.messages) line(m);
        scroller.scrollTop = scroller.scrollHeight;

        const bar = document.createElement('div');
        bar.className = 'chat-inputbar';
        const input = ui.textInput({ placeholder: `Speak as ${myHandle}…` });
        input.classList.add('chat-input', 'dark-input');
        const send = document.createElement('button');
        send.className = 'chat-send dark-send';
        send.textContent = '›';
        bar.append(input, send);
        view.append(bar);

        async function doSend() {
            const body = input.value.trim();
            if (!body) return;
            send.disabled = true;
            const r = await PhoneOS.api('darkchat:send', { roomId: room.id, body });
            send.disabled = false;
            if (r && r.ok) {
                input.value = '';
                line(r.data);
                scroller.scrollTop = scroller.scrollHeight;
            }
        }
        send.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
        input.focus();

        appendFn = (m) => {
            line(m);
            scroller.scrollTop = scroller.scrollHeight;
        };
    }

    function joinScreen(view) {
        view.textContent = '';
        view.classList.add('dark-view');
        view.append(ui.header('', { back: { label: 'Cancel', onTap: () => roomsScreen(view) } }));

        const content = ui.content();

        content.append(ui.label('Join with a code'));
        const codeInput = ui.textInput({ placeholder: '6-character code' });
        codeInput.classList.add('dark-input');
        const aliasInput = ui.textInput({ placeholder: 'Alias (blank = random)' });
        aliasInput.classList.add('dark-input');
        const joinForm = document.createElement('div');
        joinForm.className = 'form-fields';
        joinForm.append(codeInput, aliasInput);
        content.append(joinForm);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const join = document.createElement('button');
        join.className = 'primary-btn';
        join.textContent = 'Join Room';
        join.addEventListener('click', async () => {
            error.textContent = '';
            const res = await PhoneOS.api('darkchat:join', {
                code: codeInput.value.trim(), alias: aliasInput.value.trim(),
            });
            if (res && res.ok) { roomScreen(view, res.data); return; }
            error.textContent = {
                gone: 'No room with that code.',
                already: 'You\'re already in that room.',
            }[res && res.error] || 'Couldn\'t join.';
        });
        content.append(join);

        content.append(ui.label('Or start your own'));
        const nameInput = ui.textInput({ placeholder: 'Room name' });
        nameInput.classList.add('dark-input');
        const createForm = document.createElement('div');
        createForm.className = 'form-fields';
        createForm.append(nameInput);
        content.append(createForm);

        const create = document.createElement('button');
        create.className = 'primary-btn';
        create.textContent = 'Create Room';
        create.addEventListener('click', async () => {
            error.textContent = '';
            const res = await PhoneOS.api('darkchat:create', {
                name: nameInput.value.trim(), alias: aliasInput.value.trim(),
            });
            if (res && res.ok) { roomScreen(view, res.data); return; }
            error.textContent = 'Give the room a name.';
        });
        content.append(create);
        view.append(content);
    }

    PhoneOS.on('phone:darkchat', (data) => {
        const current = PhoneOS.router.current();
        if (PhoneOS.isOpen() && !PhoneOS.shell.isLocked()
            && current && current.id === 'darkchat' && activeRoomId === data.roomId && appendFn) {
            appendFn(data.message);
            return;
        }
        PhoneOS.notify({ app: 'darkchat', title: appTitle(), body: 'New message in a room.' });
    });

    PhoneOS.registerApp({
        id: 'darkchat', name: 'DarkChat', store: true,
        iconBg: 'linear-gradient(135deg,#2e2440,#0e0a18)',
        glyph: PhoneOS.glyphs.darkchat,
        render: roomsScreen,
    });
})();
