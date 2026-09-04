(() => {
    const ui = PhoneOS.ui;

    async function browse(view) {
        view.textContent = '';
        view.append(ui.header('Marketplace', {
            action: { label: 'Sell', onTap: () => sell(view) },
        }));

        const content = ui.content();
        const res = await PhoneOS.api('market:list');
        const listings = (res && res.ok && res.data) || [];

        if (!listings.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Nothing for sale right now.';
            content.append(empty);
        } else {
            for (const l of listings) {
                const card = document.createElement('div');
                card.className = 'listing-card';

                if (l.image) {
                    const img = document.createElement('img');
                    img.className = 'listing-image';
                    img.src = l.image;
                    card.append(img);
                }

                const info = document.createElement('div');
                info.className = 'listing-info';
                const top = document.createElement('div');
                top.className = 'listing-top';
                const title = document.createElement('div');
                title.className = 'listing-title';
                title.textContent = l.title;
                const price = document.createElement('div');
                price.className = 'listing-price';
                price.textContent = l.price > 0 ? ui.fmtMoney(l.price) : 'Free';
                top.append(title, price);

                const body = document.createElement('div');
                body.className = 'listing-body';
                body.textContent = l.body;

                const meta = document.createElement('div');
                meta.className = 'listing-meta';
                meta.textContent = `${l.mine ? 'Your listing' : PhoneOS.resolveName(l.seller)} · ${ui.fmtWhen(l.at)}`;

                info.append(top, body, meta);

                const actions = document.createElement('div');
                actions.className = 'listing-actions';
                if (l.mine) {
                    const del = document.createElement('button');
                    del.className = 'contact-action photo-delete';
                    del.textContent = 'Remove';
                    del.addEventListener('click', async () => {
                        if (await ui.confirm(view, 'Remove this listing?', 'Remove')) {
                            await PhoneOS.api('market:delete', { id: l.id });
                            browse(view);
                        }
                    });
                    actions.append(del);
                } else {
                    const msg = document.createElement('button');
                    msg.className = 'contact-action';
                    msg.textContent = 'Message';
                    msg.addEventListener('click', () =>
                        PhoneOS.router.openApp('messages', null, { composeTo: l.seller }));
                    const call = document.createElement('button');
                    call.className = 'contact-action';
                    call.textContent = 'Call';
                    call.addEventListener('click', () => PhoneOS.startCall(l.seller));
                    actions.append(msg, call);
                }
                info.append(actions);
                card.append(info);
                content.append(card);
            }
        }
        view.append(content);
    }

    function sell(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Cancel', onTap: () => browse(view) } }));

        const content = ui.content();
        content.append(ui.label('New listing'));

        const titleInput = ui.textInput({ placeholder: 'What are you selling?' });
        const priceInput = ui.textInput({ placeholder: 'Price ($, 0 = free)', type: 'number' });
        const bodyInput = document.createElement('textarea');
        bodyInput.className = 'text-input note-body-input';
        bodyInput.style.minHeight = '120px';
        bodyInput.placeholder = 'Describe it…';

        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(titleInput, priceInput, bodyInput);
        content.append(form);

        let imageUrl = null;
        const attach = document.createElement('button');
        attach.className = 'contact-action';
        attach.textContent = '📷 Add Photo';
        attach.addEventListener('click', async () => {
            const photo = await PhoneOS.pickPhoto();
            if (photo) {
                imageUrl = photo.url;
                attach.textContent = '📷 Photo added';
            }
        });
        content.append(attach);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const post = document.createElement('button');
        post.className = 'primary-btn';
        post.textContent = 'Post Listing';
        post.addEventListener('click', async () => {
            error.textContent = '';
            const res = await PhoneOS.api('market:post', {
                title: titleInput.value.trim(),
                body: bodyInput.value.trim(),
                price: Number(priceInput.value) || 0,
                imageUrl,
            });
            if (res && res.ok) { browse(view); return; }
            error.textContent = {
                empty: 'A title and description are required.',
                bad_price: 'That price doesn\'t look right.',
                full: 'You\'ve hit your listing limit — remove one first.',
                rate_limited: 'Slow down a little.',
            }[res && res.error] || 'Couldn\'t post the listing.';
        });
        content.append(post);
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'market', name: 'Marketplace', store: true,
        iconBg: 'linear-gradient(135deg,#ffb45e,#e8752f)',
        glyph: PhoneOS.glyphs.market,
        render: browse,
    });
})();
