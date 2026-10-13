(() => {
    const ui = PhoneOS.ui;
    const ICON = {
        lock: '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3z"/></svg>',
        unlock: '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 5 5v2h-2V7a3 3 0 0 0-6 0v3h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h8V7a5 5 0 0 1 5-5z"/></svg>',
        horn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l6 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
        lights: '<svg viewBox="0 0 24 24"><path d="M13.5 5C18 5 21 8 21 12s-3 7-7.5 7H11V5h2.5zM2 7h7v1.8H2zm0 4.1h7v1.8H2zm0 4.1h7V17H2z"/></svg>',
        engine: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 4v7h2V6zm-3.6 1.4A6.8 6.8 0 0 0 12 19a6.8 6.8 0 0 0 4.6-11.6l-1.4 1.4A4.8 4.8 0 1 1 8.8 8.8z"/></svg>',
        locate: '<svg viewBox="0 0 24 24"><path d="M20.5 3.5L3.6 10.7c-.6.3-.5 1.2.1 1.3l7 1.3 1.3 7c.1.7 1 .8 1.3.1l7.2-16.9z"/></svg>',
        key: '<svg viewBox="0 0 24 24"><path d="M7.5 9a5.5 5.5 0 0 1 10.6-2H22v3h-1.6v2.5h-3V10h-.9A5.5 5.5 0 1 1 7.5 9zm5.5 0a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z" transform="translate(-2 3)"/></svg>',
    };
    const STATE = { 0: 'Out', 1: 'Garaged', 2: 'Impounded' };
    const ERRORS = {
        too_far: 'You need to be closer to the car.',
        not_found: 'The car isn’t showing up yet. Try again in a few seconds.',
        asleep: 'The car isn’t answering. Walk a bit closer.',
        not_yours: 'You don’t have a key to that car anymore.',
        rate_limited: 'Slow down a little.',
        disabled: 'This server turned that off.',
    };

    let data = null;
    let tab = null;
    let valet = null;
    let liveTimer = null;

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    function prettyModel(model) {
        if (!model) return 'Vehicle';
        return model.charAt(0).toUpperCase() + model.slice(1);
    }

    function nameOf(v) {
        return v.label || prettyModel(v.model);
    }

    function carImage(v, cls, images) {
        const box = el('div', 'gv-img ' + (cls || ''));
        const fallback = () => {
            box.textContent = '';
            box.classList.add('fallback');
            box.innerHTML = PhoneOS.glyphs.garage;
        };
        const pattern = images !== undefined ? images : ((data && data.images) || '');
        const model = v.image || (v.model ? String(v.model).toLowerCase() : '');
        if (!pattern || !model) { fallback(); return box; }
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.onerror = fallback;
        img.src = pattern.replace('%s', encodeURIComponent(model));
        box.append(img);
        return box;
    }

    function plate(text) {
        const p = el('div', 'gv-plate');
        p.append(el('span', 'gv-plate-state', 'San Andreas'), el('span', 'gv-plate-num', String(text || '').trim() || '—'));
        return p;
    }

    function ringGauge(label, pct) {
        const wrap = el('div', 'gv-gauge');
        const p = Math.max(0, Math.min(100, Number(pct) || 0));
        const colour = p < 25 ? '#ff453a' : (p < 55 ? '#ff9f0a' : '#30d158');
        wrap.innerHTML = '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="gv-ring-bg"/>'
            + `<circle cx="22" cy="22" r="18" class="gv-ring" stroke="${colour}" stroke-dasharray="${(p / 100 * 113.1).toFixed(1)} 113.1"/></svg>`;
        wrap.append(el('div', 'gv-gauge-val', p + '%'), el('div', 'gv-gauge-label', label));
        return wrap;
    }

    function fmtLeft(ms) {
        if (!ms) return 'Until you take it back';
        const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
        if (mins < 60) return `${mins} min left`;
        const h = Math.round(mins / 60);
        return h < 48 ? `${h} h left` : `${Math.round(h / 24)} days left`;
    }

    function liveLine(live) {
        if (!live) return 'Not showing on the map right now';
        const dist = live.dist < 1000 ? `${live.dist} m away` : `${(live.dist / 1000).toFixed(1)} km away`;
        return `${live.locked ? 'Locked' : 'Unlocked'} · Engine ${live.engine ? 'on' : 'off'} · ${dist}`;
    }

    function remotePanel(plateText, label, opts) {
        const box = el('div', 'gv-remote');
        const status = el('div', 'gv-remote-status', 'Checking the car…');
        const grid = el('div', 'gv-remote-grid');
        let live = opts && opts.live ? opts.live : null;

        const button = (key, text, glyph, action) => {
            const b = el('button', 'gv-rbtn');
            b.type = 'button';
            b.dataset.key = key;
            const ic = el('div', 'gv-rbtn-ic');
            ic.innerHTML = glyph;
            b.append(ic, el('div', 'gv-rbtn-label', text));
            b.addEventListener('click', async () => {
                const act = typeof action === 'function' ? action() : action;
                b.disabled = true;
                b.classList.add('busy');
                const res = await PhoneOS.api('garage:remote', { plate: plateText, action: act });
                b.disabled = false;
                b.classList.remove('busy');
                if (res && res.ok) {
                    PhoneOS.sounds.tick();
                    live = res.data;
                    paint();
                } else {
                    status.textContent = ERRORS[res && res.error] || 'The car didn’t respond.';
                    status.classList.add('warn');
                }
            });
            grid.append(b);
            return b;
        };

        const lockBtn = button('lock', 'Lock', ICON.lock, () => (live && live.locked ? 'unlock' : 'lock'));
        button('honk', 'Horn', ICON.horn, 'honk');
        button('lights', 'Lights', ICON.lights, 'lights');
        const engineBtn = button('engine', 'Start', ICON.engine, () => (live && live.engine ? 'engine_off' : 'engine_on'));
        const find = el('button', 'gv-rbtn');
        find.type = 'button';
        const fic = el('div', 'gv-rbtn-ic locate');
        fic.innerHTML = ICON.locate;
        find.append(fic, el('div', 'gv-rbtn-label', 'Find'));
        find.addEventListener('click', async () => {
            const res = await PhoneOS.api('garage:ping', { plate: plateText });
            if (res && res.ok) {
                PhoneOS.router.openApp('maps', null, { pin: { x: res.data.x, y: res.data.y, label: label, sender: null, live: false } });
            } else {
                status.textContent = ERRORS[res && res.error] || 'Couldn’t find the car.';
                status.classList.add('warn');
            }
        });
        grid.append(find);

        function paint() {
            status.classList.remove('warn');
            status.textContent = liveLine(live);
            lockBtn.querySelector('.gv-rbtn-ic').innerHTML = live && live.locked ? ICON.lock : ICON.unlock;
            lockBtn.querySelector('.gv-rbtn-label').textContent = live && live.locked ? 'Unlock' : 'Lock';
            lockBtn.classList.toggle('on', !!(live && live.locked));
            engineBtn.querySelector('.gv-rbtn-label').textContent = live && live.engine ? 'Stop' : 'Start';
            engineBtn.classList.toggle('on', !!(live && live.engine));
        }

        async function refresh() {
            const res = await PhoneOS.api('garage:car', { plate: plateText });
            if (res && res.ok) {
                live = res.data.live;
                paint();
                if (opts && opts.onCar) opts.onCar(res.data);
            }
        }

        box.append(status, grid);
        paint();
        if (!live) status.textContent = 'Checking the car…';
        box.refresh = refresh;
        return box;
    }
    PhoneOS.carRemote = remotePanel;
    PhoneOS.carImage = carImage;
    PhoneOS.carPlate = plate;

    function stopLive() {
        clearInterval(liveTimer);
        liveTimer = null;
    }

    function valetCard(view) {
        if (!valet || valet.phase !== 'coming') return null;
        const card = el('div', 'gv-valet');
        const ic = el('div', 'gv-valet-ic');
        ic.innerHTML = PhoneOS.glyphs.garage;
        const body = el('div', 'gv-valet-body');
        body.append(el('div', 'gv-valet-title', 'Valet is on the way'),
            el('div', 'gv-valet-sub', `${valet.label || 'Your car'} · ${valet.dist ? (valet.dist < 1000 ? valet.dist + ' m' : (valet.dist / 1000).toFixed(1) + ' km') : ''}`));
        const eta = el('div', 'gv-valet-eta', fmtEta(valet.eta));
        const track = el('div', 'gv-valet-track');
        const fill = el('div', 'gv-valet-fill');
        fill.style.width = progress(valet) + '%';
        track.append(fill);
        card.append(ic, body, eta, track);
        card.addEventListener('click', () => {
            if (typeof valet.x === 'number') {
                PhoneOS.router.openApp('maps', null, { pin: { x: valet.x, y: valet.y, label: 'Valet', live: false } });
            }
        });
        return card;
    }

    function fmtEta(s) {
        if (!s && s !== 0) return '';
        if (s >= 60) return Math.round(s / 60) + ' min';
        return Math.max(1, s) + ' s';
    }

    let valetStartDist = null;
    function progress(v) {
        if (!v || !v.dist) return 6;
        if (!valetStartDist || v.dist > valetStartDist) valetStartDist = v.dist;
        return Math.min(96, Math.max(6, 100 - (v.dist / valetStartDist) * 100));
    }

    function carCard(view, v) {
        const card = el('div', 'gv-card');
        card.append(carImage(v));
        const info = el('div', 'gv-card-info');
        const top = el('div', 'gv-card-top');
        top.append(el('div', 'gv-card-name', nameOf(v)), plate(v.plate));
        let line = '';
        if (v.state === 1) line = v.garage ? `Parked at ${v.garage}` : 'In the garage';
        else if (v.state === 2) line = 'In the impound lot';
        else line = v.live ? liveLine(v.live) : 'Out on the street';
        const sub = el('div', 'gv-card-sub', line);
        const fuel = el('div', 'gv-fuel');
        const fuelFill = el('div', 'gv-fuel-fill' + (v.fuel < 25 ? ' low' : ''));
        fuelFill.style.width = Math.max(3, Math.min(100, v.fuel)) + '%';
        fuel.append(fuelFill);
        const fuelRow = el('div', 'gv-fuel-row');
        fuelRow.append(el('span', 'gv-fuel-label', 'Fuel'), fuel, el('span', 'gv-fuel-val', v.fuel + '%'));
        info.append(top, sub, fuelRow);
        card.append(info);
        card.addEventListener('click', () => details(view, v));
        return card;
    }

    async function render(view) {
        stopLive();
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('Garage'));
        const skel = ui.skeleton(3);
        view.append(skel);
        const res = await PhoneOS.api('garage:list');
        if (!fresh()) return;
        skel.remove();

        const content = ui.content();
        if (!res || !res.ok) {
            content.append(el('div', 'empty-state', res && res.error === 'no_table'
                ? 'The garage app can’t read this server’s vehicle data.' : 'Couldn’t load your vehicles.'));
            view.append(content);
            return;
        }
        data = Array.isArray(res.data) ? { vehicles: res.data } : res.data;
        const vehicles = data.vehicles || [];

        const vc = valetCard(view);
        if (vc) content.append(vc);

        if (!vehicles.length) {
            content.append(el('div', 'empty-state', 'You don’t own any vehicles.'));
            view.append(content);
            return;
        }

        const counts = { 0: 0, 1: 0, 2: 0 };
        for (const v of vehicles) counts[v.state in counts ? v.state : 0] += 1;
        if (tab === null || !counts[tab]) tab = counts[0] ? 0 : (counts[1] ? 1 : 2);

        const seg = el('div', 'seg-control gv-tabs');
        for (const k of [0, 1, 2]) {
            const o = el('div', 'seg-option' + (tab === k ? ' selected' : ''), ({ 0: 'Out', 1: 'Garaged', 2: 'Impound' })[k]);
            if (counts[k]) o.append(el('span', 'gv-count', String(counts[k])));
            o.addEventListener('click', () => { tab = k; render(view); });
            seg.append(o);
        }
        content.append(seg);

        const list = vehicles.filter((v) => (v.state in counts ? v.state : 0) === tab);
        if (!list.length) {
            content.append(el('div', 'empty-state', { 0: 'Nothing out right now.', 1: 'Nothing in the garage.', 2: 'Nothing in the impound.' }[tab]));
        }
        for (const v of list) content.append(carCard(view, v));
        view.append(content);
    }

    async function details(view, v) {
        stopLive();
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Garage', onTap: () => render(view) } }));
        const content = ui.content();
        content.classList.add('gv-detail');

        const hero = el('div', 'gv-hero');
        hero.append(carImage(v, 'big'));
        const title = el('div', 'gv-title', nameOf(v));
        const chip = el('div', 'gv-chip s' + v.state, STATE[v.state] || 'Out');
        const row = el('div', 'gv-title-row');
        row.append(plate(v.plate), chip);
        content.append(hero, title, row);

        const gauges = el('div', 'gv-gauges');
        gauges.append(ringGauge('Fuel', v.fuel), ringGauge('Engine', v.engine), ringGauge('Body', v.body));
        content.append(gauges);

        let holdersBox = null;
        if (v.state === 0 && data.remote && data.remote.enabled) {
            content.append(ui.label('Remote'));
            const panel = remotePanel(v.plate, nameOf(v), {
                live: v.live,
                onCar: (car) => { if (holdersBox && car.holders) paintHolders(car.holders); },
            });
            content.append(panel);
            panel.refresh();
            liveTimer = setInterval(() => {
                if (!fresh() || !document.body.contains(panel)) { stopLive(); return; }
                panel.refresh();
            }, 4000);
        } else if (v.state === 1 && data.valet && data.valet.enabled) {
            const vb = el('button', 'primary-btn gv-valet-btn');
            vb.type = 'button';
            vb.textContent = `Bring It to Me · ${ui.fmtMoney(data.valet.cost)}`;
            const note = el('div', 'gv-note', data.valet.drive
                ? 'A valet drives it over and hands you the keys.' : 'It shows up right next to you.');
            vb.addEventListener('click', async () => {
                if (valet && valet.phase === 'coming') {
                    PhoneOS.notify({ app: 'garage', title: 'Valet', body: 'A valet is already on the way.' });
                    return;
                }
                if (!await ui.confirm(view, `Have the ${nameOf(v)} brought to you for ${ui.fmtMoney(data.valet.cost)}?`, 'Order Valet', { danger: false })) return;
                vb.disabled = true;
                const r = await PhoneOS.api('garage:valet', { plate: v.plate });
                if (r && r.ok) {
                    PhoneOS.notify({ app: 'garage', title: 'Valet', body: 'Your valet is on it.' });
                    tab = 0;
                    render(view);
                } else {
                    vb.disabled = false;
                    PhoneOS.notify({ app: 'garage', title: 'Valet', body: {
                        insufficient: 'You can’t afford the valet.',
                        not_garaged: 'That car isn’t in a garage.',
                        no_model: 'That car’s saved data is missing its model.',
                        busy: 'A valet is already on the way.',
                        rate_limited: 'The valet needs a breather.',
                    }[r && r.error] || 'The valet couldn’t take the job.' });
                }
            });
            content.append(vb, note);
        } else if (v.state === 2) {
            content.append(el('div', 'gv-note box', 'This car is in the impound. Collect it at the impound lot.'));
        }

        if (data.keys && data.keys.enabled) {
            content.append(ui.label('Shared keys'));
            holdersBox = el('div', 'gv-holders');
            content.append(holdersBox);
            paintHolders([]);
            PhoneOS.api('garage:car', { plate: v.plate }).then((res) => {
                if (res && res.ok && fresh()) paintHolders(res.data.holders || []);
            });
        }

        function paintHolders(holders) {
            holdersBox.textContent = '';
            const rows = holders.map((h) => {
                const name = h.number ? PhoneOS.resolveName(h.number) : 'Someone';
                const r = ui.row({ text: name, control: (() => {
                    const b = el('button', 'hm-remove', 'Remove');
                    b.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (!await ui.confirm(view, `Take ${name}’s key to the ${nameOf(v)}?`, 'Remove Key')) return;
                        const res = await PhoneOS.api('garage:revokeKey', { plate: v.plate, cid: h.cid });
                        if (res && res.ok) {
                            const again = await PhoneOS.api('garage:car', { plate: v.plate });
                            if (again && again.ok) paintHolders(again.data.holders || []);
                        }
                    });
                    return b;
                })() });
                const left = el('div', 'tx-note', fmtLeft(h.expires));
                r.querySelector('.row-label').append(left);
                r.prepend(ui.avatar(name, 30, h.number ? PhoneOS.contactAvatar(h.number) : null));
                return r;
            });
            const ic = el('div', 'hm-row-ic key');
            ic.innerHTML = ICON.key;
            const add = ui.row({ icon: ic, text: 'Share a Key', chevron: true, onTap: () => shareSheet(view, v, paintHolders) });
            add.classList.add('hm-give');
            holdersBox.append(ui.group([...rows, add]));
        }
        view.append(content);
    }

    async function shareSheet(view, v, onDone) {
        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        const overlay = el('div', 'picker-overlay');
        const sheet = el('div', 'picker-sheet');
        sheet.append(el('div', 'picker-title', 'Share a key to the ' + nameOf(v)));
        let hours = 6;
        const chips = el('div', 'gv-durations');
        for (const [h, label] of [[1, '1 hour'], [6, '6 hours'], [24, '1 day'], [72, '3 days'], [0, 'Until removed']]) {
            const c = el('button', 'gv-dur' + (h === hours ? ' on' : ''), label);
            c.type = 'button';
            c.addEventListener('click', () => {
                hours = h;
                [...chips.children].forEach((x) => x.classList.toggle('on', x === c));
            });
            chips.append(c);
        }
        const error = el('div', 'form-error');
        const share = async (number) => {
            error.textContent = '';
            const res = await PhoneOS.api('garage:shareKey', { plate: v.plate, to: number, hours });
            if (res && res.ok) {
                overlay.remove();
                PhoneOS.notify({ app: 'garage', title: 'Garage', body: 'Key shared.' });
                const again = await PhoneOS.api('garage:car', { plate: v.plate });
                if (again && again.ok) onDone(again.data.holders || []);
                return;
            }
            error.textContent = {
                invalid_number: 'That number isn’t in service.',
                full: 'This car has as many shared keys as it can.',
                rate_limited: 'Slow down a little.',
            }[res && res.error] || 'Couldn’t share the key.';
        };
        const dial = el('div', 'picker-url-row');
        const input = ui.textInput({ placeholder: 'Enter a number…' });
        input.inputMode = 'tel';
        const go = el('button', 'chat-send ready', '›');
        go.addEventListener('click', () => { const n = input.value.trim(); if (n) share(n); });
        dial.append(input, go);
        sheet.append(chips, dial, error);
        if (contacts.length) {
            sheet.append(ui.group(contacts.map((c) => {
                const r = ui.row({ text: c.name, value: c.number, onTap: () => share(c.number) });
                r.prepend(ui.avatar(c.name, 30, c.avatar || null));
                return r;
            })));
        }
        const cancel = el('button', 'confirm-btn', 'Cancel');
        cancel.addEventListener('click', () => overlay.remove());
        sheet.append(cancel);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        view.append(overlay);
    }

    let arrivedTimer = null;
    PhoneOS.on('phone:valet', (d) => {
        if (!d) return;
        if (d.phase === 'coming') {
            valet = d;
            clearTimeout(arrivedTimer);
            PhoneOS.island.show('valet', () => valet && {
                icon: PhoneOS.glyphs.garage,
                iconBg: 'linear-gradient(135deg,#5ee87a,#21b04a)',
                title: 'Valet · ' + (valet.label || 'Your car'),
                subtitle: valet.dist ? (valet.dist < 1000 ? valet.dist + ' m away' : (valet.dist / 1000).toFixed(1) + ' km away') : 'On the way',
                right: fmtEta(valet.eta),
                progress: progress(valet),
                onTap: () => PhoneOS.router.openApp('garage'),
            });
        } else {
            valet = null;
            valetStartDist = null;
            if (d.phase === 'arrived') {
                PhoneOS.island.show('valet', {
                    icon: PhoneOS.glyphs.garage,
                    iconBg: 'linear-gradient(135deg,#5ee87a,#21b04a)',
                    title: (d.label || 'Your car') + ' is here',
                    subtitle: 'Enjoy the drive',
                    right: '✓',
                    progress: 100,
                });
                arrivedTimer = setTimeout(() => PhoneOS.island.clear('valet'), 8000);
            } else {
                PhoneOS.island.clear('valet');
            }
        }
        const view = document.querySelector('.app-view[data-app="garage"]');
        const card = view && view.querySelector('.gv-valet');
        if (card && valet) {
            card.querySelector('.gv-valet-eta').textContent = fmtEta(valet.eta);
            card.querySelector('.gv-valet-fill').style.width = progress(valet) + '%';
        } else if (view && !view.querySelector('.gv-detail') && (card || d.phase === 'coming')) {
            render(view);
        }
    });

    PhoneOS.registerApp({
        id: 'garage', name: 'Garage',
        iconBg: 'linear-gradient(135deg,#7f8ca6,#4a5568)',
        glyph: PhoneOS.glyphs.garage,
        render,
        onClose: stopLive,
    });
})();
