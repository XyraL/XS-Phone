(() => {
    const ui = PhoneOS.ui;
    let account;
    let currentFolder = 'inbox';

    async function loadAccount(force) {
        if (account !== undefined && !force) return account;
        const res = await PhoneOS.api('mail:me');
        account = (res && res.ok && res.data && res.data.address) || null;
        if (res && res.ok && res.data) domain = res.data.domain || domain;
        return account;
    }
    let domain = 'ls.mail';

    async function render(view) {
        const addr = await loadAccount();
        if (!addr) { authScreen(view); return; }
        inbox(view);
    }

    function authScreen(view) {
        view.textContent = '';
        view.append(ui.header('Mail'));
        const content = ui.content();
        content.append(ui.authForm({
            title: 'Mail',
            sub: 'Your own address in the city. Anyone can write to you, from any phone.',
            iconBg: 'linear-gradient(135deg,#5fa8f5,#2f6fd1)',
            glyph: PhoneOS.glyphs.mail,
            idPlaceholder: 'address',
            idSuffix: '@' + domain,
            suffixOnLogin: true,
            onSubmit: async (mode, id, pw) => {
                const res = await PhoneOS.api(
                    mode === 'signup' ? 'mail:signup' : 'mail:login',
                    { username: id, password: pw });
                if (res && res.ok) {
                    account = res.data.address;
                    inbox(view);
                    return null;
                }
                return {
                    taken: 'That address is taken.',
                    bad_username: 'Addresses are 3–30 characters: a-z, 0-9, dots, underscores.',
                    bad_password: 'Passwords are 4–32 characters.',
                    bad_login: 'Wrong address or password.',
                    already: 'This phone already has an account. Log out first.',
                    rate_limited: 'Too many tries — wait a minute.',
                }[res && res.error] || 'Something went wrong.';
            },
        }));
        view.append(content);
    }

    async function inbox(view) {
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('Mail', {
            action: { label: '+', onTap: () => compose(view, null) },
        }));

        const tabs = document.createElement('div');
        tabs.className = 'feed-tabs';
        for (const [id, labelText] of [['inbox', 'Inbox'], ['sent', 'Sent']]) {
            const t = document.createElement('div');
            t.className = 'feed-tab' + (currentFolder === id ? ' selected' : '');
            t.textContent = labelText;
            t.addEventListener('click', () => { currentFolder = id; inbox(view); });
            tabs.append(t);
        }
        view.append(tabs);

        const content = ui.content();
        const skel = ui.skeleton(5);
        view.append(skel);
        const res = await PhoneOS.api('mail:list', { folder: currentFolder });
        if (!fresh()) return;
        skel.remove();
        const mails = (res && res.ok && res.data) || [];

        if (!mails.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = currentFolder === 'inbox'
                ? 'Your inbox is empty.' : 'Nothing sent yet.';
            content.append(empty);
        } else {
            content.append(ui.group(mails.map((m) => {
                const other = currentFolder === 'inbox' ? m.fromAddress : m.toAddress;
                const r = document.createElement('div');
                r.className = 'mail-row' + (m.isRead || currentFolder === 'sent' ? '' : ' unread');
                const top = document.createElement('div');
                top.className = 'mr-top';
                const from = document.createElement('div');
                from.className = 'mr-from';
                from.textContent = (currentFolder === 'sent' ? 'To: ' : '') + other;
                const when = document.createElement('div');
                when.className = 'mr-when';
                when.textContent = ui.fmtWhen(m.at);
                top.append(from, when);
                const subject = document.createElement('div');
                subject.className = 'mr-subject';
                subject.textContent = m.subject;
                const snippet = document.createElement('div');
                snippet.className = 'mr-snippet';
                snippet.textContent = m.body.slice(0, 70);
                const info = document.createElement('div');
                info.className = 'mr-info';
                info.append(top, subject, snippet);
                r.append(ui.avatar(other, 40), info);
                r.addEventListener('click', () => reader(view, m));
                return r;
            })));
        }

        content.append(ui.label('Account'));
        content.append(ui.group([
            ui.row({ text: account, value: '' }),
            ui.row({ text: 'Log Out', danger: true, onTap: async () => {
                if (!await ui.confirm(view, 'Log out of ' + account + '?', 'Log Out')) return;
                await PhoneOS.api('mail:logout');
                account = null;
                authScreen(view);
            } }),
        ]));
        view.append(content);
    }

    async function reader(view, mail) {
        if (!mail.isRead && currentFolder === 'inbox') {
            mail.isRead = true;
            PhoneOS.api('mail:read', { id: mail.id });
            PhoneOS.clearBadge('mail');
        }

        view.textContent = '';
        view.append(ui.header('', {
            back: { label: 'Mail', onTap: () => inbox(view) },
            action: { label: 'Delete', onTap: async () => {
                if (await ui.confirm(view, 'Delete this mail?', 'Delete')) {
                    await PhoneOS.api('mail:delete', { id: mail.id });
                    inbox(view);
                }
            } },
        }));

        const content = ui.content();
        const subject = document.createElement('div');
        subject.className = 'mail-subject';
        subject.textContent = mail.subject;
        const meta = document.createElement('div');
        meta.className = 'mail-meta';
        meta.textContent = `From ${mail.fromAddress}\nTo ${mail.toAddress} · ${ui.fmtWhen(mail.at)}`;
        const body = document.createElement('div');
        body.className = 'mail-body';
        body.textContent = mail.body;
        content.append(subject, meta, body);

        if (mail.image) {
            const img = document.createElement('img');
            img.className = 'pc-image';
            img.src = mail.image;
            content.append(img);
        }

        if (currentFolder === 'inbox' && mail.fromAddress !== account) {
            const reply = document.createElement('button');
            reply.className = 'primary-btn';
            reply.textContent = 'Reply';
            reply.addEventListener('click', () => compose(view, {
                to: mail.fromAddress,
                subject: mail.subject.startsWith('Re:') ? mail.subject : 'Re: ' + mail.subject,
            }));
            content.append(reply);
        }
        view.append(content);
    }

    async function compose(view, prefill) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Cancel', onTap: () => inbox(view) } }));

        const content = ui.content();
        content.append(ui.label('New mail'));

        const toInput = ui.textInput({ placeholder: 'To (name@' + domain + ')', value: prefill && prefill.to });
        const subjectInput = ui.textInput({ placeholder: 'Subject', value: prefill && prefill.subject });
        const bodyInput = document.createElement('textarea');
        bodyInput.className = 'text-input note-body-input';
        bodyInput.style.minHeight = '170px';
        bodyInput.placeholder = 'Write your mail…';

        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(toInput, subjectInput, bodyInput);
        content.append(form);

        let imageUrl = null;
        const attach = document.createElement('button');
        attach.className = 'contact-action';
        attach.textContent = '📷 Attach Photo';
        attach.addEventListener('click', async () => {
            const photo = await PhoneOS.pickPhoto();
            if (photo) {
                imageUrl = photo.url;
                attach.textContent = '📷 Photo attached';
            }
        });
        content.append(attach);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const send = document.createElement('button');
        send.className = 'primary-btn';
        send.textContent = 'Send';
        send.addEventListener('click', async () => {
            error.textContent = '';
            send.disabled = true;
            const res = await PhoneOS.api('mail:send', {
                to: toInput.value.trim(),
                subject: subjectInput.value.trim(),
                body: bodyInput.value,
                imageUrl,
            });
            send.disabled = false;
            if (res && res.ok) {
                PhoneOS.notify({ app: 'mail', title: 'Mail', body: 'Mail sent.' });
                currentFolder = 'sent';
                inbox(view);
                return;
            }
            error.textContent = {
                invalid_address: 'No account with that address.',
                empty: 'A subject and body are required.',
                rate_limited: 'Slow down a little.',
            }[res && res.error] || 'Couldn\'t send the mail.';
        });
        content.append(send);
        view.append(content);
        if (prefill) bodyInput.focus(); else toInput.focus();
    }

    PhoneOS.on('phone:open', () => { account = undefined; });

    PhoneOS.registerApp({
        id: 'mail', name: 'Mail',
        iconBg: 'linear-gradient(135deg,#5fa8f5,#2f6fd1)',
        glyph: PhoneOS.glyphs.mail,
        render,
    });
})();
