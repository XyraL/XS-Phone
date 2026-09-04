(() => {
    const ui = PhoneOS.ui;

    const STATES = {
        0: { label: 'Out', cls: 'gs-out' },
        1: { label: 'Garaged', cls: 'gs-in' },
        2: { label: 'Impound', cls: 'gs-impound' },
    };

    function prettyModel(model) {
        if (!model) return 'Vehicle';
        return model.charAt(0).toUpperCase() + model.slice(1);
    }

    function bar(labelText, pct, danger) {
        const wrap = document.createElement('div');
        wrap.className = 'gv-bar-wrap';
        const lab = document.createElement('span');
        lab.className = 'gv-bar-label';
        lab.textContent = labelText;
        const track = document.createElement('div');
        track.className = 'gv-bar-track';
        const fill = document.createElement('div');
        fill.className = 'gv-bar-fill' + (pct < 30 || danger ? ' low' : '');
        fill.style.width = Math.max(2, Math.min(100, pct)) + '%';
        track.append(fill);
        const val = document.createElement('span');
        val.className = 'gv-bar-val';
        val.textContent = pct + '%';
        wrap.append(lab, track, val);
        return wrap;
    }

    async function render(view) {
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('Garage'));

        const content = ui.content();
        const res = await PhoneOS.api('garage:list');
        if (!fresh()) return;

        if (!res || !res.ok) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = res && res.error === 'no_table'
                ? 'The garage app can\'t read this server\'s vehicle data.'
                : 'Couldn\'t load your vehicles.';
            content.append(empty);
            view.append(content);
            return;
        }

        const data = Array.isArray(res.data) ? { vehicles: res.data } : res.data;
        const vehicles = data.vehicles || [];
        const ping = data.ping || { enabled: false };
        const valet = data.valet || { enabled: false };

        if (!vehicles.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'You don\'t own any vehicles.';
            content.append(empty);
            view.append(content);
            return;
        }

        for (const v of vehicles) {
            const card = document.createElement('div');
            card.className = 'garage-card';

            const top = document.createElement('div');
            top.className = 'gv-top';
            const name = document.createElement('div');
            name.className = 'gv-name';
            name.textContent = (v.label || prettyModel(v.model));
            const state = STATES[v.state] || STATES[0];
            const chip = document.createElement('div');
            chip.className = 'gv-state ' + state.cls;
            chip.textContent = state.label;
            top.append(name, chip);

            const meta = document.createElement('div');
            meta.className = 'gv-meta';
            const plate = document.createElement('span');
            plate.className = 'gv-plate';
            plate.textContent = v.plate || '—';
            meta.append(plate);
            if (v.garage && v.state === 1) {
                meta.append(document.createTextNode(' · ' + v.garage));
            }

            card.append(top, meta,
                bar('Fuel', v.fuel),
                bar('Engine', v.engine),
                bar('Body', v.body));

            const actions = document.createElement('div');
            actions.className = 'listing-actions';

            if (v.state === 0 && ping.enabled) {
                const pingBtn = document.createElement('button');
                pingBtn.className = 'contact-action';
                pingBtn.textContent = 'Ping GPS';
                pingBtn.addEventListener('click', async () => {
                    pingBtn.disabled = true;
                    const r = await PhoneOS.api('garage:ping', { plate: v.plate });
                    pingBtn.disabled = false;
                    if (r && r.ok) {
                        await PhoneOS.nui('setWaypoint', { x: r.data.x, y: r.data.y });
                        PhoneOS.notify({ app: 'garage', title: 'Garage',
                            body: `${(v.label || prettyModel(v.model))} marked on your GPS.` });
                    } else {
                        PhoneOS.notify({ app: 'garage', title: 'Garage',
                            body: r && r.error === 'not_found'
                                ? 'That car isn\'t showing on the network yet — give it a few seconds and ping again.'
                                : 'Couldn\'t ping the car.' });
                    }
                });
                actions.append(pingBtn);
            }

            if (v.state === 1 && valet.enabled) {
                const valetBtn = document.createElement('button');
                valetBtn.className = 'contact-action';
                valetBtn.textContent = `Valet · ${ui.fmtMoney(valet.cost)}`;
                valetBtn.addEventListener('click', async () => {
                    if (!await ui.confirm(view,
                        `Have the ${(v.label || prettyModel(v.model))} delivered to you for ${ui.fmtMoney(valet.cost)}?`,
                        'Order Valet', { danger: false })) return;
                    valetBtn.disabled = true;
                    const r = await PhoneOS.api('garage:valet', { plate: v.plate });
                    if (r && r.ok) {
                        PhoneOS.notify({ app: 'garage', title: 'Valet',
                            body: `On the way — about ${r.data.delay}s.` });
                        render(view);
                    } else {
                        valetBtn.disabled = false;
                        PhoneOS.notify({ app: 'garage', title: 'Valet', body: {
                            insufficient: 'You can\'t afford the valet.',
                            not_garaged: 'That car isn\'t in a garage.',
                            no_model: 'That car\'s stored data is missing its model.',
                            rate_limited: 'The valet needs a breather.',
                        }[r && r.error] || 'The valet couldn\'t take the job.' });
                    }
                });
                actions.append(valetBtn);
            }

            if (actions.children.length) card.append(actions);
            content.append(card);
        }
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'garage', name: 'Garage',
        iconBg: 'linear-gradient(135deg,#7f8ca6,#4a5568)',
        glyph: PhoneOS.glyphs.garage,
        render,
    });
})();
