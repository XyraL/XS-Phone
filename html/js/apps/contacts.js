(() => {
    const ui = PhoneOS.ui;
    let currentView = null;

    async function refresh() {
        return PhoneOS.loadContacts(true);
    }

    async function listScreen(view) {
        currentView = view;
        view.textContent = '';
        view.append(ui.header('Contacts', {
            action: { label: '+', onTap: () => formScreen(view, null) },
        }));

        const content = ui.content();
        const skel = ui.skeleton(7);
        view.append(skel);
        const contacts = await PhoneOS.loadContacts();
        skel.remove();

        const search = ui.textInput({ placeholder: 'Search' });
        search.classList.add('search-input');
        content.append(search);

        content.append(ui.group([
            ui.row({
                icon: ui.avatar(PhoneOS.state.number, 28),
                text: 'My Card',
                value: PhoneOS.state.number,
            }),
            ui.row({ text: 'Share My Number', chevron: true, onTap: () => dropScreen(view) }),
        ]));

        const listBox = document.createElement('div');
        content.append(listBox);

        function renderList(filter) {
            listBox.textContent = '';
            const q = (filter || '').toLowerCase();
            const filtered = contacts.filter((c) =>
                !q || c.name.toLowerCase().includes(q) || c.number.includes(q));

            if (!filtered.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-state';
                empty.textContent = contacts.length ? 'No matches' : 'No contacts yet. Tap + to add one.';
                listBox.append(empty);
                return;
            }

            const contactRow = (c) => {
                const r = document.createElement('div');
                r.className = 'contact-row';
                r.append(ui.avatar(c.name, 40, c.avatar));

                const info = document.createElement('div');
                info.className = 'cr-info';
                const name = document.createElement('div');
                name.className = 'cr-name';
                name.textContent = c.name;
                const num = document.createElement('div');
                num.className = 'cr-number';
                num.textContent = c.number;
                info.append(name, num);
                r.append(info);

                if (c.favorite) {
                    const star = document.createElement('span');
                    star.className = 'cr-star';
                    star.textContent = '★';
                    r.append(star);
                }
                if (c.blocked) {
                    const blocked = document.createElement('span');
                    blocked.className = 'cr-blocked';
                    blocked.textContent = 'Blocked';
                    r.append(blocked);
                }
                r.addEventListener('click', () => detailScreen(view, c));
                return r;
            };

            const favs = filtered.filter((c) => c.favorite && !c.blocked);
            if (favs.length && !q) {
                listBox.append(ui.label('Favorites'));
                listBox.append(ui.group(favs.map(contactRow)));
            }
            listBox.append(ui.label(q ? 'Results' : 'All contacts'));
            listBox.append(ui.group(filtered.map(contactRow)));
        }

        renderList('');
        search.addEventListener('input', () => renderList(search.value));
        view.append(content);
    }

    async function detailScreen(view, contact) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Contacts', onTap: () => listScreen(view) } }));

        const content = ui.content();

        const hero = document.createElement('div');
        hero.className = 'contact-hero';
        hero.append(ui.avatar(contact.name, 84, contact.avatar));
        const name = document.createElement('div');
        name.className = 'ch-name';
        name.textContent = contact.name;
        const num = document.createElement('div');
        num.className = 'ch-number';
        num.textContent = contact.number;
        hero.append(name, num);

        const actions = document.createElement('div');
        actions.className = 'contact-actions';
        const action = (label, onTap) => {
            const b = document.createElement('button');
            b.className = 'contact-action';
            b.textContent = label;
            b.addEventListener('click', onTap);
            return b;
        };
        actions.append(
            action('Message', () => PhoneOS.router.openApp('messages', null, { composeTo: contact.number })),
            action('Call', () => PhoneOS.startCall(contact.number)),
        );
        hero.append(actions);
        content.append(hero);

        const toggleApi = (apiName) => async () => {
            await PhoneOS.api(apiName, { id: contact.id });
            const fresh = await refresh();
            const updated = fresh.find((c) => c.id === contact.id);
            if (updated) detailScreen(view, updated); else listScreen(view);
        };

        content.append(ui.group([
            ui.row({ text: 'Favorite', control: ui.toggle(!!contact.favorite, toggleApi('contacts:favorite')) }),
            ui.row({ text: 'Block caller', control: ui.toggle(!!contact.blocked, toggleApi('contacts:block')) }),
        ]));

        content.append(ui.label(''));
        content.append(ui.group([
            ui.row({ text: 'Edit contact', chevron: true, onTap: () => formScreen(view, contact) }),
            ui.row({ text: 'Delete contact', danger: true, onTap: async () => {
                if (await ui.confirm(view, `Delete ${contact.name}?`, 'Delete')) {
                    await PhoneOS.api('contacts:delete', { id: contact.id });
                    await refresh();
                    listScreen(view);
                }
            } }),
        ]));

        view.append(content);
    }

    async function dropScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Contacts', onTap: () => listScreen(view) } }));

        const content = ui.content();
        content.append(ui.label('Share my number'));

        const scanning = document.createElement('div');
        scanning.className = 'drop-scanning';
        scanning.textContent = 'Looking for phones nearby…';
        content.append(scanning);
        view.append(content);

        const res = await PhoneOS.nui('dropScan');
        scanning.remove();

        const people = (res && res.ok && res.data) || [];
        if (!people.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No phones found nearby. They need Drop turned on in Settings.';
            content.append(empty);
        } else {
            content.append(ui.label('People nearby'));
            content.append(ui.group(people.map((p) => {
                const r = ui.row({ text: p.name, value: `${p.dist}m`, chevron: true, onTap: async () => {
                    const sent = await PhoneOS.api('drop:send', { targetId: p.id });
                    if (sent && sent.ok) {
                        PhoneOS.notify({ app: 'contacts', title: 'Drop',
                            body: `Card sent to ${p.name} — waiting for them to accept.` });
                        listScreen(view);
                    } else {
                        PhoneOS.notify({ app: 'contacts', title: 'Drop', body: {
                            busy: 'They already have a Drop waiting.',
                            too_far: 'They moved out of range.',
                            unavailable: 'Their Drop is turned off.',
                            rate_limited: 'Slow down a little.',
                        }[sent && sent.error] || 'Couldn\'t send your card.' });
                    }
                } });
                r.prepend(ui.avatar(p.name, 30));
                return r;
            })));
        }

        const again = document.createElement('button');
        again.className = 'primary-btn';
        again.textContent = 'Scan Again';
        again.addEventListener('click', () => dropScreen(view));
        content.append(again);
    }

    PhoneOS.on('phone:dropOffer', async (offer) => {
        const accept = await ui.confirm(
            document.getElementById('phone-screen'),
            `${offer.name} wants to share their number with you.`,
            'Accept', { danger: false });
        PhoneOS.nui('dropRespond', { accept });
        if (accept) PhoneOS.data.contacts = null;
    });

    PhoneOS.on('phone:contactsChanged', () => {
        PhoneOS.data.contacts = null;
        const current = PhoneOS.router.current();
        if (current && current.id === 'contacts' && currentView) {
            listScreen(currentView);
        }
    });

    function formScreen(view, existing, prefill) {
        view.textContent = '';
        view.append(ui.header('', {
            back: {
                label: 'Cancel',
                onTap: () => existing ? detailScreen(view, existing) : listScreen(view),
            },
        }));

        const content = ui.content();
        content.append(ui.label(existing ? 'Edit contact' : 'New contact'));

        let avatarUrl = (existing && existing.avatar) || null;
        const photoWrap = document.createElement('div');
        photoWrap.className = 'contact-photo-pick';
        function paintPhoto() {
            photoWrap.textContent = '';
            photoWrap.append(ui.avatar(
                (existing && existing.name) || 'New Contact', 76, avatarUrl));
            const hint = document.createElement('div');
            hint.className = 'cpp-hint';
            hint.textContent = avatarUrl ? 'Tap to remove photo' : 'Tap to add photo';
            photoWrap.append(hint);
        }
        photoWrap.addEventListener('click', async () => {
            if (avatarUrl) {
                avatarUrl = null;
                paintPhoto();
                return;
            }
            const photo = await PhoneOS.pickPhoto();
            if (photo) {
                avatarUrl = photo.url;
                paintPhoto();
            }
        });
        paintPhoto();
        content.append(photoWrap);

        const nameInput = ui.textInput({ placeholder: 'Name', value: existing && existing.name });
        const numberInput = ui.textInput({
            placeholder: 'Number (e.g. 555-0142)',
            value: (existing && existing.number) || (prefill && prefill.number) || '',
        });
        numberInput.inputMode = 'tel';

        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(nameInput, numberInput);
        content.append(form);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const save = document.createElement('button');
        save.className = 'primary-btn';
        save.textContent = existing ? 'Save changes' : 'Add contact';
        save.addEventListener('click', async () => {
            error.textContent = '';
            const payload = {
                id: existing && existing.id,
                name: nameInput.value.trim(),
                number: numberInput.value.trim(),
                avatarUrl,
            };
            if (!payload.name) { error.textContent = 'A name is required.'; return; }

            const res = await PhoneOS.api(existing ? 'contacts:update' : 'contacts:add', payload);
            if (!res || !res.ok) {
                error.textContent = {
                    exists: 'You already have a contact with that number.',
                    bad_number: 'That number doesn\'t look right.',
                    bad_name: 'A name is required.',
                }[res && res.error] || 'Couldn\'t save the contact.';
                return;
            }
            await refresh();
            listScreen(view);
        });
        content.append(save);

        view.append(content);
        nameInput.focus();
    }

    async function openByNumber(view, number) {
        const contacts = await PhoneOS.loadContacts();
        const digits = String(number).replace(/\D/g, '');
        const hit = (contacts || []).find((c) => c.number === number
            || (digits && c.number.replace(/\D/g, '') === digits));
        if (hit) return detailScreen(view, hit);
        return formScreen(view, null, { number });
    }

    PhoneOS.registerApp({
        id: 'contacts', name: 'Contacts', dock: true,
        iconBg: 'linear-gradient(135deg,#a8a8ad,#69696e)',
        glyph: PhoneOS.glyphs.contacts,
        render: (view, params) => (params && params.number)
            ? openByNumber(view, params.number)
            : listScreen(view),
    });
})();
