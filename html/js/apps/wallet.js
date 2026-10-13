(() => {
    const ui = PhoneOS.ui;

    async function summary() {
        const res = await PhoneOS.api('wallet:summary');
        return (res && res.ok && res.data) || { balance: 0, transactions: [] };
    }

    const BILL_ERRORS = {
        insufficient: 'Not enough money in your account.',
        gone: 'That bill was already settled.',
        pay_elsewhere: 'Pay this one from the billing menu.',
        cannot_decline: 'This one can’t be declined.',
        rate_limited: 'Slow down a little.',
    };
    const DOC = '<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM7 11v1.6h10V11H7zm0 3.5v1.6h10v-1.6H7zm0 3.5v1.6h6V18H7z"/></svg>';
    const BADGE = '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z"/></svg>';

    async function carKeys() {
        if (!PhoneOS.carRemote) return null;
        const [list, keys] = await Promise.all([PhoneOS.api('garage:list'), PhoneOS.api('garage:keys')]);
        if (!list || !list.ok || !list.data) return null;
        const d = list.data;
        if (!(d.keys && d.keys.enabled) && !(d.remote && d.remote.enabled)) return null;
        const owned = (d.vehicles || []).filter((v) => v.state !== 2);
        const shared = (keys && keys.ok && keys.data && keys.data.shared) || [];
        if (!owned.length && !shared.length) return null;
        return { owned, shared, images: d.images || '', remote: d.remote && d.remote.enabled };
    }

    function keyLeft(ms) {
        if (!ms) return 'No end date';
        const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
        if (mins < 60) return mins + ' min left';
        const h = Math.round(mins / 60);
        return h < 48 ? h + ' h left' : Math.round(h / 24) + ' days left';
    }

    function keyPass(item, images, onTap) {
        const pass = document.createElement('div');
        pass.className = 'ck-pass' + (item.shared ? ' shared' : '');
        const top = document.createElement('div');
        top.className = 'ck-top';
        const kicker = document.createElement('div');
        kicker.className = 'ck-kicker';
        kicker.textContent = item.shared ? 'Shared Key' : 'Car Key';
        const name = document.createElement('div');
        name.className = 'ck-name';
        name.textContent = item.label || 'Vehicle';
        top.append(kicker, name);
        const sub = document.createElement('div');
        sub.className = 'ck-sub';
        sub.textContent = item.shared
            ? 'From ' + (item.owner || 'the owner') + ' · ' + keyLeft(item.expires)
            : (item.state === 1 ? 'In the garage' : 'Ready');
        pass.append(PhoneOS.carImage(item, 'ck-img', images), top, sub, PhoneOS.carPlate(item.plate));
        pass.addEventListener('click', onTap);
        return pass;
    }

    function keySheet(view, item, images, remoteOn) {
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet ck-sheet';
        const head = document.createElement('div');
        head.className = 'ck-sheet-head';
        const t = document.createElement('div');
        t.className = 'ck-sheet-title';
        t.textContent = item.label || 'Vehicle';
        head.append(PhoneOS.carImage(item, 'ck-sheet-img', images), t, PhoneOS.carPlate(item.plate));
        sheet.append(head);
        if (!remoteOn) {
            const note = document.createElement('div');
            note.className = 'gv-note box';
            note.textContent = 'Remote controls are turned off on this server.';
            sheet.append(note);
        } else if (item.state === 1 && !item.shared) {
            const note = document.createElement('div');
            note.className = 'gv-note box';
            note.textContent = 'This car is in the garage. Order the valet from the Garage app.';
            const open = document.createElement('button');
            open.className = 'confirm-btn confirm-primary';
            open.textContent = 'Open Garage';
            open.addEventListener('click', () => { overlay.remove(); PhoneOS.router.openApp('garage'); });
            sheet.append(note, open);
        } else {
            const panel = PhoneOS.carRemote(item.plate, item.label || 'Your car', {});
            sheet.append(panel);
            panel.refresh();
        }
        const close = document.createElement('button');
        close.className = 'confirm-btn';
        close.textContent = 'Close';
        close.addEventListener('click', () => overlay.remove());
        sheet.append(close);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        view.append(overlay);
    }

    async function bills() {
        if (!(PhoneOS.state.features && PhoneOS.state.features.bills)) return null;
        const res = await PhoneOS.api('bills:list');
        return res && res.ok ? res.data : null;
    }

    function billIcon(b) {
        const ic = document.createElement('div');
        ic.className = 'bill-ic' + (b.fine ? ' fine' : '');
        ic.innerHTML = b.fine ? BADGE : DOC;
        return ic;
    }

    function billSheet(view, b, cash) {
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet bill-sheet';
        const top = billIcon(b);
        top.classList.add('big');
        const amount = document.createElement('div');
        amount.className = 'bill-amount';
        amount.textContent = ui.fmtMoney(b.amount);
        const payee = document.createElement('div');
        payee.className = 'bill-payee';
        payee.textContent = (b.fine ? 'Fine · ' : 'Bill · ') + b.payee;
        sheet.append(top, amount, payee);
        if (b.label) {
            const reason = document.createElement('div');
            reason.className = 'bill-reason';
            reason.textContent = b.label;
            sheet.append(reason);
        }
        if (b.from) {
            const from = document.createElement('div');
            from.className = 'bill-from';
            from.textContent = 'Issued by ' + b.from;
            sheet.append(from);
        }
        const error = document.createElement('div');
        error.className = 'form-error';
        const pay = document.createElement('button');
        pay.className = 'confirm-btn confirm-primary';
        pay.textContent = 'Pay ' + ui.fmtMoney(b.amount);
        if (typeof cash === 'number' && cash < b.amount) {
            pay.disabled = true;
            error.textContent = BILL_ERRORS.insufficient;
        }
        const act = async (name, btn) => {
            error.textContent = '';
            btn.disabled = true;
            const res = await PhoneOS.api(name, { source: b.source, id: b.id });
            btn.disabled = false;
            if (!res || !res.ok) { error.textContent = BILL_ERRORS[res && res.error] || 'That didn’t go through.'; return; }
            overlay.remove();
            PhoneOS.notify({ app: 'wallet', title: 'Wallet',
                body: name === 'bills:pay' ? 'Paid ' + ui.fmtMoney(res.data.amount) + ' to ' + (res.data.payee || b.payee) + '.' : 'Bill declined.' });
            render(view);
        };
        pay.addEventListener('click', () => act('bills:pay', pay));
        sheet.append(error, pay);
        if (b.canDecline) {
            const decline = document.createElement('button');
            decline.className = 'confirm-btn bill-decline';
            decline.textContent = 'Decline';
            decline.addEventListener('click', async () => {
                if (!await ui.confirm(view, 'Decline this bill?', 'Decline')) return;
                act('bills:decline', decline);
            });
            sheet.append(decline);
        }
        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Close';
        cancel.addEventListener('click', () => overlay.remove());
        sheet.append(cancel);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        view.append(overlay);
    }

    async function render(view) {
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('Wallet'));

        const content = ui.content();
        const [data, billData, keyData] = await Promise.all([summary(), bills(), carKeys()]);
        if (!fresh()) return;

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

        if (keyData) {
            content.append(ui.label('Car Keys'));
            const row = document.createElement('div');
            row.className = 'ck-row';
            const items = [
                ...keyData.owned.map((v) => ({ ...v, shared: false })),
                ...keyData.shared.map((k) => ({ ...k, shared: true, state: 0 })),
            ];
            for (const item of items) {
                row.append(keyPass(item, keyData.images, () => keySheet(view, item, keyData.images, keyData.remote)));
            }
            content.append(row);
        }

        if (billData && billData.issuer) {
            const issue = document.createElement('button');
            issue.className = 'contact-action wallet-issue';
            issue.textContent = 'Send a Bill as ' + billData.issuer;
            issue.addEventListener('click', () => issueScreen(view, billData.issuer));
            content.append(issue);
        }

        if (billData) {
            const due = billData.bills.reduce((n, b) => n + b.amount, 0);
            content.append(ui.label(billData.bills.length ? 'Bills · ' + ui.fmtMoney(due) + ' due' : 'Bills'));
            if (!billData.bills.length) {
                const none = document.createElement('div');
                none.className = 'bill-none';
                none.textContent = 'You’re all paid up.';
                content.append(none);
            } else {
                content.append(ui.group(billData.bills.map((b) => {
                    const amount = document.createElement('div');
                    amount.className = 'tx-amount bill-due';
                    amount.textContent = ui.fmtMoney(b.amount);
                    const r = ui.row({ icon: billIcon(b), text: b.payee, control: amount, chevron: true,
                        onTap: () => billSheet(view, b, billData.cash) });
                    if (b.label) {
                        const note = document.createElement('div');
                        note.className = 'tx-note';
                        note.textContent = b.label;
                        r.querySelector('.row-label').append(note);
                    }
                    return r;
                })));
            }
        }

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
        if (billData && billData.history.length) {
            content.append(ui.label('Settled bills'));
            content.append(ui.group(billData.history.map((h) => {
                const amount = document.createElement('div');
                amount.className = 'tx-amount ' + (h.status === 'declined' ? 'bill-declined' : 'tx-out');
                amount.textContent = h.status === 'declined' ? 'Declined' : '−' + ui.fmtMoney(h.amount);
                const r = ui.row({ text: h.payee || 'Bill', value: ui.fmtWhen(h.at), control: amount });
                if (h.label) {
                    const note = document.createElement('div');
                    note.className = 'tx-note';
                    note.textContent = h.label;
                    r.querySelector('.row-label').append(note);
                }
                return r;
            })));
        }
        view.append(content);
    }

    async function issueScreen(view, issuer) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Wallet', onTap: () => render(view) } }));
        const content = ui.content();
        content.append(ui.label('Send a bill as ' + issuer));

        const toInput = ui.textInput({ placeholder: 'Their number (e.g. 555-0142)' });
        toInput.inputMode = 'tel';
        const amountInput = ui.textInput({ placeholder: 'Amount', type: 'number' });
        const reasonInput = ui.textInput({ placeholder: 'What it’s for' });
        reasonInput.maxLength = 120;
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(toInput, amountInput, reasonInput);
        content.append(form);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);
        const go = document.createElement('button');
        go.className = 'primary-btn';
        go.textContent = 'Send Bill';
        go.addEventListener('click', async () => {
            error.textContent = '';
            go.disabled = true;
            const res = await PhoneOS.api('bills:send', {
                to: toInput.value.trim(), amount: Number(amountInput.value), reason: reasonInput.value.trim(),
            });
            go.disabled = false;
            if (res && res.ok) {
                PhoneOS.notify({ app: 'wallet', title: 'Wallet', body: 'Bill sent.' });
                render(view);
                return;
            }
            error.textContent = {
                invalid_number: 'That number isn’t in service.',
                bad_amount: 'Enter a valid amount.',
                no_reason: 'Say what the bill is for.',
                not_allowed: 'You need to be on duty to send bills.',
                rate_limited: 'Slow down a little.',
            }[res && res.error] || 'Couldn’t send the bill.';
        });
        content.append(go);

        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        if (contacts.length) {
            content.append(ui.label('Contacts'));
            content.append(ui.group(contacts.map((c) => {
                const r = ui.row({ text: c.name, value: c.number, onTap: () => { toInput.value = c.number; } });
                r.prepend(ui.avatar(c.name, 30));
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

    PhoneOS.on('phone:billsChanged', () => {
        const cur = PhoneOS.router.current();
        const view = document.querySelector('.app-view[data-app="wallet"]');
        if (cur && cur.id === 'wallet' && view && !view.querySelector('.form-fields')) render(view);
    });

    PhoneOS.registerApp({
        id: 'wallet', name: 'Wallet',
        iconBg: 'linear-gradient(135deg,#3b3b40,#111114)',
        glyph: PhoneOS.glyphs.wallet,
        render,
    });
})();
