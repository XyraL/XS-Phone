(() => {
    const ui = PhoneOS.ui;

    const appTitle = () => PhoneOS.appName('services');

    async function render(view) {
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header(appTitle()));

        const content = ui.content();
        const res = await PhoneOS.api('city:list');
        if (!fresh()) return;
        const entries = (res && res.ok && res.data) || [];

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Nothing listed yet.';
            content.append(empty);
            view.append(content);
            return;
        }

        const emergencies = entries.filter((e) => e.emergency && e.number);
        if (emergencies.length) {
            const panel = document.createElement('div');
            panel.className = 'city-911';
            const label = document.createElement('div');
            label.className = 'city-911-label';
            label.textContent = 'Emergency';
            const row = document.createElement('div');
            row.className = 'city-911-row';
            for (const e of emergencies) {
                const btn = document.createElement('button');
                btn.className = 'city-911-btn';
                const big = document.createElement('div');
                big.className = 'c9-big';
                big.textContent = e.number;
                const sub = document.createElement('div');
                sub.className = 'c9-sub';
                sub.textContent = `${e.label} · ${e.onDuty} on duty`;
                btn.append(big, sub);
                btn.addEventListener('click', () => emergencySheet(e));
                row.append(btn);
            }
            panel.append(label, row);
            content.append(panel);
        }

        const byCategory = {};
        for (const e of entries.filter((x) => !x.emergency)) {
            (byCategory[e.category] = byCategory[e.category] || []).push(e);
        }

        for (const [category, list] of Object.entries(byCategory)) {
            content.append(ui.label(category));
            content.append(ui.group(list.map((biz) => bizRow(view, biz))));
        }
        view.append(content);
    }

    function bizRow(view, biz) {
        const r = document.createElement('div');
        r.className = 'service-row';

        const info = document.createElement('div');
        info.className = 'sr-info';
        const top = document.createElement('div');
        top.className = 'biz-top';
        const name = document.createElement('span');
        name.className = 'sr-name';
        name.textContent = biz.label;
        const chip = document.createElement('span');
        chip.className = 'biz-chip ' + (biz.open ? 'biz-open' : 'biz-closed');
        chip.textContent = biz.open ? 'OPEN' : 'CLOSED';
        top.append(name, chip);

        const sub = document.createElement('div');
        sub.className = 'sr-sub';
        sub.textContent = biz.open
            ? `${biz.onDuty} working right now` : 'Nobody on duty';
        if (biz.number) sub.textContent += ` · ${biz.number}`;
        info.append(top, sub);

        if (biz.announcement) {
            const ann = document.createElement('div');
            ann.className = 'biz-announcement';
            ann.textContent = biz.announcement;
            info.append(ann);
        }
        r.append(info);

        const actions = document.createElement('div');
        actions.className = 'sr-actions';

        if (biz.number) {
            const call = document.createElement('button');
            call.className = 'contact-action';
            call.textContent = 'Call';
            call.disabled = !biz.open;
            call.addEventListener('click', () => PhoneOS.startCall(biz.number));

            const text = document.createElement('button');
            text.className = 'contact-action';
            text.textContent = 'Text';
            text.disabled = !biz.open;
            text.addEventListener('click', () =>
                PhoneOS.router.openApp('messages', null, { composeTo: biz.number }));

            actions.append(call, text);
        }

        if (biz.isBoss) {
            const edit = document.createElement('button');
            edit.className = 'contact-action';
            edit.textContent = '✎';
            edit.title = 'Set announcement';
            edit.addEventListener('click', () => announcementSheet(view, biz));
            actions.append(edit);
        }
        r.append(actions);
        return r;
    }

    function emergencySheet(e) {
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet';

        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = `${e.label} · ${e.number}`;

        const call = document.createElement('button');
        call.className = 'confirm-btn confirm-primary';
        call.textContent = `Call ${e.number}`;
        call.addEventListener('click', () => {
            overlay.remove();
            PhoneOS.startCall(e.number);
        });

        const text = document.createElement('button');
        text.className = 'confirm-btn';
        text.textContent = `Text ${e.number}`;
        text.addEventListener('click', () => {
            overlay.remove();
            PhoneOS.router.openApp('messages', null, { composeTo: e.number });
        });

        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());

        sheet.append(title, call, text, cancel);
        overlay.append(sheet);
        document.getElementById('phone-screen').append(overlay);
    }

    function announcementSheet(view, biz) {
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet';

        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = `${biz.label} announcement`;

        const input = ui.textInput({
            placeholder: 'e.g. Half-price repairs until 8pm (blank clears)',
            value: biz.announcement || '',
        });
        input.maxLength = 140;

        const save = document.createElement('button');
        save.className = 'confirm-btn confirm-primary';
        save.textContent = 'Publish';
        save.addEventListener('click', async () => {
            const res = await PhoneOS.api('city:setAnnouncement', { text: input.value.trim() });
            overlay.remove();
            if (res && res.ok) render(view);
        });

        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());

        sheet.append(title, input, save, cancel);
        overlay.append(sheet);
        document.getElementById('phone-screen').append(overlay);
    }

    PhoneOS.registerApp({
        id: 'services', name: 'City',
        iconBg: 'linear-gradient(135deg,#43b5a0,#20826f)',
        glyph: PhoneOS.glyphs.services,
        render,
    });
})();
