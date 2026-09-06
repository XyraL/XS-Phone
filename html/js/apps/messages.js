(() => {
    const ui = PhoneOS.ui;
    let activeView = null;     // the .app-view container while the app is open
    let activeThreadId = null; // thread currently on screen, for live appends
    let me = null;

    function threadTitle(t) {
        if (t.isGroup) return t.name || 'Group';
        return PhoneOS.resolveName((t.others && t.others[0]) || 'Unknown');
    }

    async function loadThreads() {
        const res = await PhoneOS.api('messages:threads');
        if (res && res.ok) {
            PhoneOS.data.threads = res.data || [];
            me = res.me || me;
        }
        return PhoneOS.data.threads || [];
    }

    async function threadsScreen(view) {
        const fresh = PhoneOS.freshRender(view);
        activeView = view;
        activeThreadId = null;
        view.textContent = '';
        view.append(ui.header('Messages', {
            action: { label: '+', onTap: () => composeScreen(view) },
        }));

        const content = ui.content();
        await PhoneOS.loadContacts();
        const threads = await loadThreads();
        if (!fresh()) return;

        if (!threads.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No conversations yet. Tap + to start one.';
            content.append(empty);
        } else {
            const rows = threads.map((t) => {
                const r = document.createElement('div');
                r.className = 'thread-row' + (t.unread > 0 ? ' unread' : '');
                const dot = document.createElement('div');
                dot.className = 'tr-dot';
                r.append(dot);
                const other = !t.isGroup && t.others && t.others[0];
                r.append(ui.avatar(threadTitle(t), 44, other ? PhoneOS.contactAvatar(other) : null));

                const info = document.createElement('div');
                info.className = 'tr-info';
                const top = document.createElement('div');
                top.className = 'tr-top';
                const name = document.createElement('div');
                name.className = 'tr-name';
                name.textContent = threadTitle(t) + (t.muted ? ' 🔇' : '');
                const when = document.createElement('div');
                when.className = 'tr-when';
                when.textContent = ui.fmtWhen(t.lastAt) + ' ›';
                top.append(name, when);

                const preview = document.createElement('div');
                preview.className = 'tr-preview';
                const previewText = t.lastBody || (t.lastMedia ? '📷 Photo' : '');
                preview.textContent = previewText
                    ? (t.lastSender === me ? 'You: ' : '') + previewText
                    : 'No messages yet';

                info.append(top, preview);
                r.append(info);

                r.addEventListener('click', () => chatScreen(view, t));
                return r;
            });
            content.append(ui.group(rows));
        }
        view.append(content);
    }

    async function chatScreen(view, thread, composeTo) {
        activeView = view;
        activeThreadId = thread ? thread.id : null;
        view.textContent = '';

        const title = thread ? threadTitle(thread) : PhoneOS.resolveName(composeTo);
        const otherNumber = thread
            ? (!thread.isGroup && thread.others && thread.others[0])
            : composeTo;

        const head = document.createElement('div');
        head.className = 'imsg-head';
        const back = document.createElement('button');
        back.className = 'ah-back';
        back.textContent = 'Messages';
        back.addEventListener('click', () => threadsScreen(view));
        const center = document.createElement('button');
        center.type = 'button';
        center.className = 'imsg-head-center';
        center.title = thread && thread.isGroup ? 'Group info' : 'Contact';
        center.append(ui.avatar(title, 40, otherNumber ? PhoneOS.contactAvatar(otherNumber) : null));
        const nm = document.createElement('div');
        nm.className = 'imsg-head-name';
        nm.textContent = title;
        center.append(nm);
        center.addEventListener('click', () => {
            if (thread && thread.isGroup) optionsScreen(view, thread);
            else if (otherNumber) contactSheet(otherNumber, title);
        });
        head.append(back, center);
        if (thread) {
            const opts = document.createElement('button');
            opts.className = 'ah-action';
            opts.textContent = '⋯';
            opts.addEventListener('click', () => optionsScreen(view, thread));
            head.append(opts);
        } else {
            head.append(document.createElement('span'));
        }
        view.append(head);

        const scroller = document.createElement('div');
        scroller.className = 'chat-scroller';
        const list = document.createElement('div');
        list.className = 'chat-list';
        scroller.append(list);
        view.append(scroller);

        let oldest = null;
        let allMsgs = [];

        const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        function sepText(ms) {
            const d = new Date(ms);
            const now = new Date();
            const time = PhoneOS.clock.timeString(d);
            if (d.toDateString() === now.toDateString()) return `Today ${time}`;
            if (Date.now() - ms < 6 * 86400000) return `${DAYS[d.getDay()]} ${time}`;
            return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)} ${time}`;
        }

        function renderAll(keepOffset) {
            const prevH = scroller.scrollHeight;
            const prevTop = scroller.scrollTop;
            list.textContent = '';

            allMsgs.forEach((m, i) => {
                const prev = allMsgs[i - 1];
                const next = allMsgs[i + 1];
                const mine = m.sender === me;

                if (!prev || m.sentAt - prev.sentAt > 1800000) {
                    const sep = document.createElement('div');
                    sep.className = 'msg-datesep';
                    sep.textContent = sepText(m.sentAt);
                    list.append(sep);
                }

                const wrap = document.createElement('div');
                wrap.className = 'bubble-wrap ' + (mine ? 'mine' : 'theirs');
                if (next && next.sender === m.sender && next.sentAt - m.sentAt < 60000) {
                    wrap.classList.add('stack');
                }

                if (!mine && thread && thread.isGroup
                    && (!prev || prev.sender !== m.sender)) {
                    const who = document.createElement('div');
                    who.className = 'bubble-sender';
                    who.textContent = PhoneOS.resolveName(m.sender);
                    wrap.append(who);
                }

                const b = document.createElement('div');
                b.className = 'bubble' + (m.media ? ' bubble-media' : '');
                if (m.media) {
                    const img = document.createElement('img');
                    img.className = 'bubble-img';
                    img.src = m.media;
                    b.append(img);
                }
                if (m.body) {
                    const txt = document.createElement('div');
                    txt.textContent = m.body;
                    b.append(txt);
                }
                b.title = new Date(m.sentAt).toLocaleString();
                wrap.append(b);
                list.append(wrap);
            });

            const last = allMsgs[allMsgs.length - 1];
            if (last && last.sender === me) {
                const status = document.createElement('div');
                status.className = 'msg-status';
                status.textContent = 'Delivered';
                list.append(status);
            }

            if (keepOffset) {
                scroller.scrollTop = scroller.scrollHeight - prevH + prevTop;
            } else {
                scroller.scrollTop = scroller.scrollHeight;
            }
        }

        async function loadPage(before) {
            if (!thread) return { hasMore: false };
            const res = await PhoneOS.api('messages:getThread', { threadId: thread.id, before });
            if (!res || !res.ok) return { hasMore: false };
            const msgs = res.data.messages;
            allMsgs = before ? [...msgs, ...allMsgs] : [...allMsgs, ...msgs];
            if (msgs.length) oldest = Math.min(oldest ?? Infinity, msgs[0].id);
            renderAll(!!before);
            return res.data;
        }

        const first = await loadPage(null);
        if (first.hasMore) {
            const more = document.createElement('button');
            more.className = 'load-earlier';
            more.textContent = 'Load earlier messages';
            more.addEventListener('click', async () => {
                const page = await loadPage(oldest);
                if (!page.hasMore) more.remove();
            });
            scroller.prepend(more);
        }

        const bar = document.createElement('div');
        bar.className = 'chat-inputbar';
        const attach = document.createElement('button');
        attach.className = 'chat-attach';
        attach.innerHTML = PhoneOS.glyphs.camera;
        const input = ui.textInput({ placeholder: 'Text Message' });
        input.classList.add('chat-input');
        const send = document.createElement('button');
        send.className = 'chat-send';
        send.textContent = '↑';
        input.addEventListener('input', () => {
            send.classList.toggle('ready', input.value.trim().length > 0);
        });
        bar.append(attach, input, send);
        view.append(bar);

        async function doSend(mediaUrl) {
            const body = input.value.trim();
            if (!body && !mediaUrl) return;
            if (PhoneOS.state.settings.airplane) {
                PhoneOS.notify({ app: 'settings', title: 'Airplane Mode', body: 'Turn it off to send messages.' });
                return;
            }
            send.disabled = true;
            const payload = thread ? { threadId: thread.id, body } : { to: composeTo, body };
            if (mediaUrl) payload.mediaUrl = mediaUrl;
            const res = await PhoneOS.api('messages:send', payload);
            send.disabled = false;

            if (!res || !res.ok) {
                PhoneOS.notify({
                    app: 'messages', title: 'Not delivered',
                    body: res && res.error === 'invalid_number'
                        ? 'That number isn\'t in service.' : 'Message failed to send.',
                });
                return;
            }
            input.value = '';
            send.classList.remove('ready');
            if (!thread) {
                await loadThreads();
                const created = (PhoneOS.data.threads || []).find((x) => x.id === res.data.threadId);
                if (created) { chatScreen(view, created); return; }
            }
            allMsgs.push(res.data);
            renderAll();
        }
        send.addEventListener('click', () => doSend());
        attach.addEventListener('click', async () => {
            const photo = await PhoneOS.pickPhoto();
            if (photo) doSend(photo.url);
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
        input.focus();

        chatScreen.append = (m) => {
            allMsgs.push(m);
            renderAll();
            PhoneOS.api('messages:markRead', { threadId: activeThreadId });
        };
    }

    function optionsScreen(view, thread) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Back', onTap: () => chatScreen(view, thread) } }));

        const content = ui.content();
        content.append(ui.label(threadTitle(thread)));

        if (thread.isGroup && thread.others) {
            content.append(ui.group(
                thread.others.map((n) => ui.row({ text: PhoneOS.resolveName(n), value: n }))));
            content.append(ui.label(''));
        }

        content.append(ui.group([
            ui.row({ text: 'Mute conversation', control: ui.toggle(!!thread.muted, async () => {
                await PhoneOS.api('messages:toggleMute', { threadId: thread.id });
                thread.muted = thread.muted ? 0 : 1;
            }) }),
            ui.row({ text: thread.isGroup ? 'Leave group' : 'Delete conversation', danger: true, onTap: async () => {
                const label = thread.isGroup ? 'Leave' : 'Delete';
                if (await ui.confirm(view, `${label} this conversation?`, label)) {
                    await PhoneOS.api('messages:leave', { threadId: thread.id });
                    threadsScreen(view);
                }
            } }),
        ]));
        view.append(content);
    }

    async function composeScreen(view) {
        view.textContent = '';
        view.append(ui.header('', {
            back: { label: 'Cancel', onTap: () => threadsScreen(view) },
            action: { label: 'New Group', onTap: () => groupScreen(view) },
        }));

        const content = ui.content();
        content.append(ui.label('New message'));

        const numberInput = ui.textInput({ placeholder: 'Enter a number…' });
        numberInput.classList.add('search-input');
        numberInput.inputMode = 'tel';
        content.append(numberInput);

        const go = document.createElement('button');
        go.className = 'primary-btn';
        go.textContent = 'Start conversation';
        go.addEventListener('click', () => {
            const to = numberInput.value.trim();
            if (to) chatScreen(view, null, to);
        });
        content.append(go);

        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        if (contacts.length) {
            content.append(ui.label('Contacts'));
            content.append(ui.group(contacts.map((c) => {
                const r = ui.row({ text: c.name, value: c.number, chevron: true,
                    onTap: () => chatScreen(view, null, c.number) });
                r.prepend(ui.avatar(c.name, 30));
                return r;
            })));
        }
        view.append(content);
    }

    async function groupScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Cancel', onTap: () => composeScreen(view) } }));

        const content = ui.content();
        content.append(ui.label('New group'));

        const nameInput = ui.textInput({ placeholder: 'Group name' });
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(nameInput);
        content.append(form);

        const picked = new Set();
        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        content.append(ui.label('Members'));
        content.append(ui.group(contacts.map((c) => {
            const check = document.createElement('div');
            check.className = 'radio-check';
            const r = ui.row({ text: c.name, control: check, onTap: () => {
                if (picked.has(c.number)) picked.delete(c.number); else picked.add(c.number);
                check.textContent = picked.has(c.number) ? '✓' : '';
            } });
            r.classList.add('tappable');
            return r;
        })));

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const create = document.createElement('button');
        create.className = 'primary-btn';
        create.textContent = 'Create group';
        create.addEventListener('click', async () => {
            error.textContent = '';
            if (!nameInput.value.trim()) { error.textContent = 'Give the group a name.'; return; }
            if (picked.size < 1) { error.textContent = 'Pick at least one member.'; return; }
            const res = await PhoneOS.api('messages:createGroup',
                { name: nameInput.value.trim(), members: [...picked] });
            if (!res || !res.ok) { error.textContent = 'Couldn\'t create the group.'; return; }
            await loadThreads();
            const created = (PhoneOS.data.threads || []).find((x) => x.id === res.data.threadId);
            if (created) chatScreen(view, created); else threadsScreen(view);
        });
        content.append(create);
        view.append(content);
    }

    async function contactSheet(number, title) {
        const contacts = await PhoneOS.loadContacts();
        const digits = String(number).replace(/\D/g, '');
        const saved = (contacts || []).find((c) => c.number === number
            || (digits && c.number.replace(/\D/g, '') === digits));

        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet contact-sheet';

        const hero = document.createElement('div');
        hero.className = 'cs-hero';
        hero.append(ui.avatar(title, 72, PhoneOS.contactAvatar(number)));
        const name = document.createElement('div');
        name.className = 'cs-name';
        name.textContent = saved ? saved.name : (title !== number ? title : 'Unknown number');
        const num = document.createElement('div');
        num.className = 'cs-num';
        num.textContent = number;
        hero.append(name, num);

        const call = document.createElement('button');
        call.className = 'confirm-btn confirm-primary';
        call.textContent = 'Call';
        call.addEventListener('click', () => { overlay.remove(); PhoneOS.startCall(number); });

        const contact = document.createElement('button');
        contact.className = 'confirm-btn';
        contact.textContent = saved ? 'View Contact' : 'Add Contact';
        contact.addEventListener('click', () => {
            overlay.remove();
            PhoneOS.router.openApp('contacts', null, { number });
        });

        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());

        sheet.append(hero, call, contact, cancel);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('phone-screen').append(overlay);
    }

    PhoneOS.on('phone:newMessage', (data) => {
        const current = PhoneOS.router.current();
        const viewingThisThread = PhoneOS.isOpen() && !PhoneOS.shell.isLocked()
            && current && current.id === 'messages'
            && activeThreadId === data.threadId;

        if (viewingThisThread && chatScreen.append) {
            chatScreen.append(data.message);
            return;
        }
        PhoneOS.notify({
            app: 'messages',
            title: PhoneOS.resolveName(data.message.sender),
            body: data.message.body,
        });
        PhoneOS.data.threads = null; // stale — refetch on next open
    });

    PhoneOS.on('phone:open', () => {
        PhoneOS.loadContacts().catch(() => {});
    });

    PhoneOS.registerApp({
        id: 'messages', name: 'Messages', dock: true,
        iconBg: 'linear-gradient(135deg,#6bdd6f,#1fb336)',
        glyph: PhoneOS.glyphs.messages,
        render: (view, params) => {
            if (params && params.composeTo) {
                loadThreads().then((threads) => {
                    const existing = threads.find((t) =>
                        !t.isGroup && t.others && t.others[0] === params.composeTo);
                    if (existing) chatScreen(view, existing);
                    else chatScreen(view, null, params.composeTo);
                });
            } else {
                threadsScreen(view);
            }
        },
    });
})();
