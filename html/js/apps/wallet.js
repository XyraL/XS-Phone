(() => {
    const ui = PhoneOS.ui;

    async function summary() {
        const res = await PhoneOS.api('wallet:summary');
        return (res && res.ok && res.data) || { balance: 0, transactions: [] };
    }

    async function render(view) {
        view.textContent = '';
        view.append(ui.header('Wallet'));

        const content = ui.content();
        const data = await summary();

        const card = document.createElement('div');
        card.className = 'wallet-card';
        const label = document.createElement('div');
        label.className = 'wc-label';
        label.textContent = 'Balance';
        const balance = document.createElement('div');
        balance.className = 'wc-balance';
        balance.textContent = ui.fmtMoney(data.balance);
        const num = document.createElement('div');
        num.className = 'wc-number';
        num.textContent = PhoneOS.state.number;
        card.append(label, balance, num);
        content.append(card);

        const send = document.createElement('button');
        send.className = 'primary-btn';
        send.textContent = 'Send Money';
        send.addEventListener('click', () => sendScreen(view));
        content.append(send);

        content.append(ui.label('Recent activity'));
        if (!data.transactions.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No transactions yet.';
            content.append(empty);
        } else {
            content.append(ui.group(data.transactions.map((t) => {
                const amount = document.createElement('div');
                amount.className = 'tx-amount ' + (t.direction === 'in' ? 'tx-in' : 'tx-out');
                amount.textContent = (t.direction === 'in' ? '+' : '−') + ui.fmtMoney(t.amount);
                const r = ui.row({
                    text: PhoneOS.resolveName(t.other),
                    value: ui.fmtWhen(t.at),
                    control: amount,
                });
                if (t.note) {
                    const lab = r.querySelector('.row-label');
                    const note = document.createElement('div');
                    note.className = 'tx-note';
                    note.textContent = t.note;
                    lab.append(note);
                }
                return r;
            })));
        }
        view.append(content);
    }

    async function sendScreen(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Wallet', onTap: () => render(view) } }));

        const content = ui.content();
        content.append(ui.label('Send money'));

        const toInput = ui.textInput({ placeholder: 'Number (e.g. 555-0142)' });
        toInput.inputMode = 'tel';
        const amountInput = ui.textInput({ placeholder: 'Amount', type: 'number' });
        const noteInput = ui.textInput({ placeholder: 'Note (optional)' });

        const chips = document.createElement('div');
        chips.className = 'wallet-chips';
        for (const v of [50, 100, 500, 1000]) {
            const c = document.createElement('button');
            c.className = 'wallet-chip';
            c.textContent = '$' + v;
            c.addEventListener('click', () => { amountInput.value = v; });
            chips.append(c);
        }

        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(toInput, amountInput, chips, noteInput);
        content.append(form);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const go = document.createElement('button');
        go.className = 'primary-btn';
        go.textContent = 'Send';
        go.addEventListener('click', async () => {
            error.textContent = '';
            go.disabled = true;
            const res = await PhoneOS.api('wallet:transfer', {
                to: toInput.value.trim(),
                amount: Number(amountInput.value),
                note: noteInput.value.trim(),
            });
            go.disabled = false;
            if (res && res.ok) {
                PhoneOS.notify({ app: 'wallet', title: 'Wallet', body: 'Money sent.' });
                render(view);
                return;
            }
            error.textContent = {
                invalid_number: 'That number doesn\'t look right.',
                bad_amount: 'Enter a valid amount.',
                offline: 'That person isn\'t reachable right now.',
                insufficient: 'Not enough money in your account.',
                rate_limited: 'Slow down a little.',
            }[res && res.error] || 'Transfer failed.';
        });
        content.append(go);

        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        if (contacts.length) {
            content.append(ui.label('Contacts'));
            content.append(ui.group(contacts.map((c) => {
                const r = ui.row({ text: c.name, value: c.number,
                    onTap: () => { toInput.value = c.number; } });
                r.prepend(ui.avatar(c.name, 30));
                return r;
            })));
        }
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'wallet', name: 'Wallet',
        iconBg: 'linear-gradient(135deg,#3b3b40,#111114)',
        glyph: PhoneOS.glyphs.wallet,
        render,
    });
})();
