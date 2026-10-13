(() => {
    const ui = PhoneOS.ui;
    const G = PhoneOS.geo;
    const SAVE_ICONS = ['pin', 'home', 'work', 'star', 'car', 'food'];
    const BALLOON = '<svg viewBox="0 0 32 42"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 26.4 16 41 16 41s15-14.6 15-25.2C31 7.6 24.3 1 16 1z" fill="#ff3b30" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15.5" r="5.2" fill="#fff"/></svg>';
    const ARROW = '<svg viewBox="0 0 24 24"><path d="M20.5 3.5L3.6 10.7c-.6.3-.5 1.2.1 1.3l7 1.3 1.3 7c.1.7 1 .8 1.3.1l7.2-16.9z"/></svg>';

    let view = null;
    let map = null;
    let layers = null;
    let meMarker = null;
    let pickMarker = null;
    let me = null;
    let follow = true;
    let selfTimer = null;
    let data = { places: [], city: [], shared: [] };
    let mode = 'peek';
    let selected = null;
    let query = '';
    let sheet = null;
    let locateBtn = null;
    let valetMarker = null;

    const ll = (x, y) => {
        const p = G.toPixel(x, y);
        return map.unproject([p.px, p.py], G.MAP.native);
    };
    const toWorld = (latlng) => {
        const p = map.project(latlng, G.MAP.native);
        return G.fromPixel(p.x, p.y);
    };
    const away = (p) => (me ? G.fmtDistance(G.distance(me, p)) : '');

    function dotIcon(kind, small) {
        const el = document.createElement('div');
        el.className = 'mp-dot' + (small ? ' small' : '');
        el.style.background = G.tint(kind);
        el.innerHTML = G.icon(kind);
        return L.divIcon({ className: 'mp-marker', html: el, iconSize: small ? [22, 22] : [28, 28], iconAnchor: small ? [11, 11] : [14, 14] });
    }

    function friendIcon(number) {
        const el = document.createElement('div');
        el.className = 'mp-friend';
        el.append(ui.avatar(PhoneOS.resolveName(number), 30, PhoneOS.contactAvatar(number)));
        return L.divIcon({ className: 'mp-marker', html: el, iconSize: [36, 42], iconAnchor: [18, 40] });
    }

    function meIcon() {
        const el = document.createElement('div');
        el.className = 'mp-me';
        el.innerHTML = '<span class="mp-me-cone"></span><span class="mp-me-pulse"></span><span class="mp-me-dot"></span>';
        return L.divIcon({ className: 'mp-marker', html: el, iconSize: [22, 22], iconAnchor: [11, 11] });
    }

    function balloonIcon() {
        const el = document.createElement('div');
        el.className = 'mp-balloon';
        el.innerHTML = BALLOON;
        return L.divIcon({ className: 'mp-marker', html: el, iconSize: [32, 42], iconAnchor: [16, 40] });
    }

    function drawPins() {
        if (!map) return;
        layers.city.clearLayers();
        layers.places.clearLayers();
        layers.shared.clearLayers();
        for (const p of data.city) {
            L.marker(ll(p.x, p.y), { icon: dotIcon(p.icon, true) })
                .on('click', () => select({ kind: 'city', ...p }, true)).addTo(layers.city);
        }
        for (const p of data.places) {
            L.marker(ll(p.x, p.y), { icon: dotIcon(p.icon) })
                .on('click', () => select({ kind: 'saved', ...p }, true)).addTo(layers.places);
        }
        const seen = new Set();
        for (const s of data.shared) {
            if (seen.has(s.sender)) continue;
            seen.add(s.sender);
            L.marker(ll(s.x, s.y), { icon: friendIcon(s.sender), zIndexOffset: 500 })
                .on('click', () => select(sharedPlace(s), true)).addTo(layers.shared);
        }
    }

    function sharedPlace(s) {
        return {
            kind: 'shared', x: s.x, y: s.y, sender: s.sender, at: s.at, live: s.live,
            label: s.live ? PhoneOS.resolveName(s.sender) : (s.label || 'Pinned Location'),
            sub: s.live ? (s.label || 'Shared location') : 'From ' + PhoneOS.resolveName(s.sender),
        };
    }

    async function load() {
        const res = await PhoneOS.api('maps:list');
        if (res && res.ok && res.data) data = res.data;
        return data;
    }

    async function refreshSelf(center) {
        const res = await PhoneOS.nui('mapSelf');
        if (!map || !res || !res.ok) return;
        me = { x: res.x, y: res.y, heading: res.heading || 0, label: res.label || '' };
        if (!meMarker) {
            meMarker = L.marker(ll(me.x, me.y), { icon: meIcon(), interactive: false, zIndexOffset: 1000 }).addTo(layers.me);
        } else {
            meMarker.setLatLng(ll(me.x, me.y));
        }
        const cone = meMarker.getElement() && meMarker.getElement().querySelector('.mp-me-cone');
        if (cone) cone.style.transform = `rotate(${-me.heading}deg)`;
        if (center) map.setView(ll(me.x, me.y), 4, { animate: false });
        else if (follow) map.panTo(ll(me.x, me.y), { animate: true, duration: 0.8 });
    }

    function paintLocate() {
        if (locateBtn) locateBtn.classList.toggle('on', follow);
    }

    async function dropPin(latlng) {
        const w = toWorld(latlng);
        const place = { kind: 'dropped', x: w.x, y: w.y, label: 'Dropped Pin', sub: '' };
        select(place);
        const res = await PhoneOS.nui('mapStreet', { x: w.x, y: w.y });
        if (selected === place && res && res.ok && res.label) {
            place.sub = res.label;
            renderSheet();
        }
    }

    function select(place, fly) {
        selected = place;
        mode = 'place';
        if (pickMarker) { pickMarker.remove(); pickMarker = null; }
        if (map && (place.kind === 'dropped' || (place.kind === 'shared' && !place.live))) {
            pickMarker = L.marker(ll(place.x, place.y), { icon: balloonIcon(), interactive: false, zIndexOffset: 800 }).addTo(map);
        }
        if (map && fly) {
            follow = false;
            paintLocate();
            map.flyTo(ll(place.x, place.y), Math.max(map.getZoom(), 4), { duration: 0.6 });
        }
        renderSheet();
    }

    function closePlace() {
        selected = null;
        mode = 'peek';
        if (pickMarker) { pickMarker.remove(); pickMarker = null; }
        renderSheet();
    }

    function circle(kind, labelText, onTap, extra) {
        const b = document.createElement('button');
        b.className = 'mp-fav' + (extra ? ' ' + extra : '');
        const ic = document.createElement('div');
        ic.className = 'mp-fav-ic';
        ic.style.background = kind ? G.tint(kind) : '';
        ic.innerHTML = kind ? G.icon(kind) : '<span>+</span>';
        const l = document.createElement('div');
        l.className = 'mp-fav-label';
        l.textContent = labelText;
        b.append(ic, l);
        b.addEventListener('click', onTap);
        return b;
    }

    function placeRow(kind, title, sub, onTap, numberForAvatar) {
        const r = document.createElement('div');
        r.className = 'mp-row';
        if (numberForAvatar) {
            r.append(ui.avatar(PhoneOS.resolveName(numberForAvatar), 34, PhoneOS.contactAvatar(numberForAvatar)));
        } else {
            const ic = document.createElement('div');
            ic.className = 'mp-row-ic';
            ic.style.background = G.tint(kind);
            ic.innerHTML = G.icon(kind);
            r.append(ic);
        }
        const info = document.createElement('div');
        info.className = 'mp-row-info';
        const t = document.createElement('div');
        t.className = 'mp-row-title';
        t.textContent = title;
        const s = document.createElement('div');
        s.className = 'mp-row-sub';
        s.textContent = sub;
        info.append(t, s);
        r.append(info);
        r.addEventListener('click', onTap);
        return r;
    }

    function joinSub(...parts) {
        return parts.filter(Boolean).join(' · ');
    }

    function searchBar() {
        const wrap = document.createElement('div');
        wrap.className = 'mp-search';
        wrap.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>';
        const input = document.createElement('input');
        input.className = 'mp-search-input';
        input.placeholder = 'Search Maps';
        input.value = query;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        input.addEventListener('focus', () => {
            if (mode !== 'list') { mode = 'list'; renderSheet(true); }
        });
        input.addEventListener('input', () => {
            query = input.value;
            renderResults();
        });
        wrap.append(input);
        return wrap;
    }

    let results = null;

    function allPlaces() {
        const out = [];
        for (const p of data.places) out.push({ kind: 'saved', ...p });
        for (const p of data.city) out.push({ kind: 'city', ...p });
        for (const s of data.shared) out.push(sharedPlace(s));
        return out;
    }

    function renderResults() {
        if (!results) return;
        results.textContent = '';
        const q = query.trim().toLowerCase();

        if (q) {
            const hits = allPlaces().filter((p) => (p.label + ' ' + (p.sub || '')).toLowerCase().includes(q));
            if (!hits.length) {
                const empty = document.createElement('div');
                empty.className = 'mp-empty';
                empty.textContent = 'No places match.';
                results.append(empty);
                return;
            }
            results.append(ui.group(hits.map((p) => placeRow(p.icon || 'pin', p.label, joinSub(p.sub, away(p)),
                () => select(p, true), p.kind === 'shared' ? p.sender : null))));
            return;
        }

        const share = placeRow('pin', 'Share My Location', me && me.label ? me.label : 'Send where you are to a contact',
            () => shareSheet({ kind: 'me' }));
        share.classList.add('mp-row-accent');
        results.append(ui.group([share]));

        if (data.shared.length) {
            results.append(ui.label('Shared with you'));
            results.append(ui.group(data.shared.map((s) => {
                const p = sharedPlace(s);
                return placeRow('pin', s.live ? PhoneOS.resolveName(s.sender) : p.label,
                    joinSub(s.live ? (s.label || 'Location') : PhoneOS.resolveName(s.sender), ui.fmtWhen(s.at), away(p)),
                    () => select(p, true), s.sender);
            })));
        }

        if (data.places.length) {
            results.append(ui.label('Saved'));
            results.append(ui.group(data.places.map((p) => placeRow(p.icon, p.label, away(p),
                () => select({ kind: 'saved', ...p }, true)))));
        }

        if (data.city.length) {
            results.append(ui.label('Around the city'));
            results.append(ui.group(data.city.map((p) => placeRow(p.icon, p.label, away(p),
                () => select({ kind: 'city', ...p }, true)))));
        }
    }

    function favouritesRow() {
        const row = document.createElement('div');
        row.className = 'mp-favs';
        for (const p of data.places) {
            row.append(circle(p.icon, p.label, () => select({ kind: 'saved', ...p }, true)));
        }
        row.append(circle(null, 'Add', () => {
            if (!me) return;
            saveSheet({ kind: 'dropped', x: me.x, y: me.y, label: '', sub: me.label });
        }, 'mp-fav-add'));
        return row;
    }

    function placeCard() {
        const p = selected;
        const card = document.createElement('div');
        card.className = 'mp-card';

        const top = document.createElement('div');
        top.className = 'mp-card-top';
        const title = document.createElement('div');
        title.className = 'mp-card-title';
        title.textContent = p.label;
        const close = document.createElement('button');
        close.className = 'mp-close';
        close.textContent = '✕';
        close.addEventListener('click', closePlace);
        top.append(title, close);

        const sub = document.createElement('div');
        sub.className = 'mp-card-sub';
        const kindText = { city: 'Place', saved: 'Saved place', dropped: '', shared: '' }[p.kind] || '';
        sub.textContent = joinSub(kindText, p.sub, away(p));

        card.append(top, sub);
        if (p.kind === 'shared' && p.sender) {
            const by = document.createElement('div');
            by.className = 'mp-card-by';
            by.textContent = (p.live ? 'Live location from ' : 'Shared by ')
                + PhoneOS.resolveName(p.sender) + (p.at ? ' · ' + ui.fmtWhen(p.at) : '');
            card.append(by);
        }

        const actions = document.createElement('div');
        actions.className = 'mp-actions';
        const gps = document.createElement('button');
        gps.className = 'mp-btn primary';
        gps.innerHTML = ARROW;
        gps.append(document.createTextNode('Set GPS'));
        gps.addEventListener('click', async () => {
            const res = await PhoneOS.nui('setWaypoint', { x: p.x, y: p.y });
            if (res && res.ok) {
                gps.classList.add('done');
                gps.lastChild.textContent = 'GPS Set';
            }
        });
        const share = document.createElement('button');
        share.className = 'mp-btn';
        share.textContent = 'Share';
        share.addEventListener('click', () => shareSheet(p));
        actions.append(gps, share);

        if (p.kind === 'saved') {
            const remove = document.createElement('button');
            remove.className = 'mp-btn danger';
            remove.textContent = 'Remove';
            remove.addEventListener('click', async () => {
                if (!await ui.confirm(view, `Remove ${p.label} from your saved places?`, 'Remove')) return;
                const res = await PhoneOS.api('maps:delete', { id: p.id });
                if (res && res.ok) {
                    data.places = data.places.filter((x) => x.id !== p.id);
                    drawPins();
                    closePlace();
                }
            });
            actions.append(remove);
        } else {
            const save = document.createElement('button');
            save.className = 'mp-btn';
            save.textContent = 'Save';
            save.addEventListener('click', () => saveSheet(p));
            actions.append(save);
        }
        card.append(actions);
        return card;
    }

    function renderSheet(focusSearch) {
        if (!sheet) return;
        sheet.textContent = '';
        sheet.className = 'mp-sheet mp-' + mode;
        results = null;

        const grab = document.createElement('div');
        grab.className = 'mp-grab';
        grab.addEventListener('click', () => {
            if (mode === 'place') return;
            mode = mode === 'list' ? 'peek' : 'list';
            if (mode === 'peek') query = '';
            renderSheet();
        });
        sheet.append(grab);

        if (mode === 'place' && selected) {
            sheet.append(placeCard());
            return;
        }

        const bar = searchBar();
        sheet.append(bar);
        if (mode === 'peek') {
            sheet.append(ui.label('Favourites'), favouritesRow());
            return;
        }
        results = document.createElement('div');
        results.className = 'mp-results';
        sheet.append(results);
        renderResults();
        if (focusSearch) bar.querySelector('input').focus();
    }

    function saveSheet(place) {
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const box = document.createElement('div');
        box.className = 'picker-sheet';
        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = 'Save place';
        const name = ui.textInput({ placeholder: 'Name', value: place.kind === 'dropped' ? '' : place.label });
        name.maxLength = 40;

        let icon = SAVE_ICONS.includes(place.icon) ? place.icon : 'pin';
        const icons = document.createElement('div');
        icons.className = 'mp-icon-pick';
        const paint = () => [...icons.children].forEach((c) => c.classList.toggle('selected', c.dataset.icon === icon));
        for (const id of SAVE_ICONS) {
            const b = document.createElement('button');
            b.className = 'mp-fav-ic';
            b.dataset.icon = id;
            b.style.background = G.tint(id);
            b.innerHTML = G.icon(id);
            b.addEventListener('click', () => { icon = id; paint(); });
            icons.append(b);
        }
        paint();

        const error = document.createElement('div');
        error.className = 'form-error';
        const go = document.createElement('button');
        go.className = 'confirm-btn confirm-primary';
        go.textContent = 'Save';
        go.addEventListener('click', async () => {
            const label = name.value.trim();
            if (!label) { error.textContent = 'Give it a name.'; return; }
            go.disabled = true;
            const res = await PhoneOS.api('maps:save', { label, icon, x: place.x, y: place.y });
            go.disabled = false;
            if (!res || !res.ok) {
                error.textContent = res && res.error === 'full' ? 'You have too many saved places.' : 'Couldn’t save it.';
                return;
            }
            overlay.remove();
            data.places.push(res.data);
            drawPins();
            select({ kind: 'saved', ...res.data });
        });
        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());

        box.append(title, name, icons, error, go, cancel);
        overlay.append(box);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        view.append(overlay);
        name.focus();
    }

    async function shareSheet(place) {
        const contacts = (await PhoneOS.loadContacts()).filter((c) => !c.blocked);
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const box = document.createElement('div');
        box.className = 'picker-sheet';
        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = place.kind === 'me' ? 'Share my location' : 'Share ' + place.label;
        box.append(title);

        const send = async (number, label) => {
            overlay.remove();
            const location = place.kind === 'me'
                ? { mine: true, label: me ? me.label : '' }
                : { x: place.x, y: place.y, label: place.kind === 'dropped' ? (place.sub || 'Dropped Pin') : place.label };
            const res = await PhoneOS.api('messages:send', { to: number, body: '', location });
            PhoneOS.notify({
                app: 'maps', title: 'Maps',
                body: res && res.ok ? 'Location sent to ' + label + '.' : 'Couldn’t send the location.',
            });
            PhoneOS.data.threads = null;
        };

        const dial = document.createElement('div');
        dial.className = 'picker-url-row';
        const input = ui.textInput({ placeholder: 'Enter a number…' });
        input.inputMode = 'tel';
        const go = document.createElement('button');
        go.className = 'chat-send ready';
        go.textContent = '›';
        go.addEventListener('click', () => { const n = input.value.trim(); if (n) send(n, n); });
        dial.append(input, go);
        box.append(dial);

        if (contacts.length) {
            box.append(ui.group(contacts.map((c) => {
                const r = ui.row({ text: c.name, value: c.number, onTap: () => send(c.number, c.name) });
                r.prepend(ui.avatar(c.name, 30, c.avatar || null));
                return r;
            })));
        }
        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());
        box.append(cancel);
        overlay.append(box);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        view.append(overlay);
    }

    function controls() {
        const box = document.createElement('div');
        box.className = 'mp-ctrl';
        const mk = (cls, html, onTap) => {
            const b = document.createElement('button');
            b.className = 'mp-ctrl-btn ' + cls;
            b.innerHTML = html;
            b.addEventListener('click', onTap);
            box.append(b);
            return b;
        };
        locateBtn = mk('locate', ARROW, () => {
            follow = true;
            paintLocate();
            if (me && map) map.flyTo(ll(me.x, me.y), Math.max(map.getZoom(), 4), { duration: 0.6 });
        });
        mk('zoom', '+', () => map && map.zoomIn());
        mk('zoom', '−', () => map && map.zoomOut());
        paintLocate();
        return box;
    }

    function initMap(canvas) {
        map = L.map(canvas, {
            crs: L.CRS.Simple,
            minZoom: 1,
            maxZoom: 6,
            zoomControl: false,
            attributionControl: false,
            zoomSnap: 0.25,
            wheelPxPerZoomLevel: 90,
        });
        const sw = map.unproject([0, G.MAP.imageH], G.MAP.native);
        const ne = map.unproject([G.MAP.imageW, 0], G.MAP.native);
        const bounds = L.latLngBounds(sw, ne);
        L.tileLayer('assets/maps/tiles/{z}_{x}_{y}.webp', {
            tileSize: G.MAP.tile,
            minZoom: 0,
            maxZoom: 6,
            maxNativeZoom: G.MAP.native,
            noWrap: true,
            bounds,
        }).addTo(map);
        map.setMaxBounds(bounds.pad(0.1));
        map.setView(ll(200, -900), 3);
        layers = {
            city: L.layerGroup().addTo(map),
            places: L.layerGroup().addTo(map),
            shared: L.layerGroup().addTo(map),
            me: L.layerGroup().addTo(map),
        };
        map.on('dragstart', () => { follow = false; paintLocate(); });
        map.on('click', (e) => dropPin(e.latlng));
    }

    function teardown() {
        clearInterval(selfTimer);
        selfTimer = null;
        if (map) map.remove();
        map = null;
        layers = null;
        meMarker = null;
        pickMarker = null;
        selected = null;
        sheet = null;
        locateBtn = null;
        valetMarker = null;
        query = '';
        mode = 'peek';
    }

    async function render(viewEl, params) {
        teardown();
        view = viewEl;
        view.textContent = '';
        view.classList.add('maps-view');
        const fresh = PhoneOS.freshRender(view);

        const canvas = document.createElement('div');
        canvas.className = 'maps-canvas';
        const scrim = document.createElement('div');
        scrim.className = 'maps-scrim';
        sheet = document.createElement('div');
        view.append(canvas, scrim, controls(), sheet);

        follow = !(params && params.pin);
        initMap(canvas);
        renderSheet();
        setTimeout(() => { if (map) map.invalidateSize(); }, 260);

        await PhoneOS.loadContacts();
        await load();
        if (!fresh() || !map) return;
        drawPins();
        await refreshSelf(!(params && params.pin));
        if (!fresh() || !map) return;
        selfTimer = setInterval(() => refreshSelf(false), 1000);

        if (params && params.pin) {
            const p = params.pin;
            select({
                kind: 'shared', x: p.x, y: p.y, sender: p.sender, at: p.at, live: p.live,
                label: p.live ? (p.sender ? PhoneOS.resolveName(p.sender) : 'My Location') : (p.label || 'Pinned Location'),
                sub: p.live ? (p.label || 'Shared location') : (p.sender ? 'From ' + PhoneOS.resolveName(p.sender) : ''),
            });
            map.setView(ll(p.x, p.y), 4, { animate: false });
        } else {
            renderSheet();
        }
    }

    PhoneOS.on('phone:valet', (d) => {
        if (!map) return;
        if (d && d.phase === 'coming' && typeof d.x === 'number') {
            if (!valetMarker) {
                valetMarker = L.marker(ll(d.x, d.y), { icon: dotIcon('car'), zIndexOffset: 900 })
                    .on('click', () => select({ kind: 'dropped', x: d.x, y: d.y, label: 'Valet', sub: (d.label || 'Your car') + ' on the way' }))
                    .addTo(map);
            } else {
                valetMarker.setLatLng(ll(d.x, d.y));
            }
        } else if (valetMarker) {
            valetMarker.remove();
            valetMarker = null;
        }
    });

    PhoneOS.registerApp({
        id: 'maps', name: 'Maps',
        iconBg: 'linear-gradient(135deg,#7bd88f,#2f9e5b)',
        glyph: PhoneOS.glyphs.maps,
        render,
        onClose: teardown,
    });
})();
