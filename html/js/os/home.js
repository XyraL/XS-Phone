PhoneOS.home = (() => {
    const COLS = 4;
    const ROWS = 6;
    const STACK_ROWS = 2;

    const QUICK = {
        messages: [{ label: 'New Message', params: { compose: true } }],
        phone: [
            { label: 'Keypad', params: { tab: 'keypad' } },
            { label: 'Recents', params: { tab: 'recents' } },
        ],
        camera: [{ label: 'Take a Selfie', params: { selfie: true } }],
        maps: [{ label: 'Share My Location', params: { share: true } }],
    };

    let pages = [];
    let page = 0;
    let editing = false;
    let suppress = false;
    let stackIndex = 0;
    let stackTimer = null;
    let alarmCache = null;
    let valet = null;
    let cancelActiveHold = null;

    const $ = (id) => document.getElementById(id);
    const width = () => $('home-pages').offsetWidth || 1;

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    function features() {
        return (PhoneOS.state && PhoneOS.state.features) || {};
    }

    function visible(def) {
        const installed = (PhoneOS.state && PhoneOS.state.installedApps) || [];
        if (def.store && !installed.includes(def.id)) return false;
        if (def.requires && !features()[def.requires]) return false;
        return true;
    }

    function capacity(i) {
        return i === 0 ? COLS * (ROWS - STACK_ROWS) : COLS * ROWS;
    }

    function computePages() {
        const ids = PhoneOS.apps.filter((d) => !d.dock && visible(d)).map((d) => d.id);
        const saved = String((PhoneOS.state && PhoneOS.state.settings.homeLayout) || '')
            .split('|').map((p) => p.split(',').filter(Boolean));
        const seen = new Set();
        const out = [];
        for (const p of saved) {
            const kept = p.filter((id) => ids.includes(id) && !seen.has(id) && seen.add(id));
            if (kept.length) out.push(kept);
        }
        const rest = ids.filter((id) => !seen.has(id));
        if (!out.length) out.push([]);
        for (const id of rest) {
            let target = out.length - 1;
            while (out[target].length >= capacity(target)) {
                target += 1;
                if (!out[target]) out.push([]);
            }
            out[target].push(id);
        }
        for (let i = 0; i < out.length; i++) {
            while (out[i].length > capacity(i)) {
                if (!out[i + 1]) out.push([]);
                out[i + 1].unshift(out[i].pop());
            }
        }
        return out.filter((p, i) => p.length || i === 0);
    }

    function saveLayout() {
        PhoneOS.state.settings.homeLayout = pages.map((p) => p.join(',')).join('|');
        if (PhoneOS.saveSettings) PhoneOS.saveSettings();
    }

    function iconEl(def) {
        const icon = el('div', 'app-icon');
        const art = PhoneOS.icons && PhoneOS.icons.art(def.id);
        if (art) {
            icon.classList.add('art');
            icon.innerHTML = art;
        } else {
            icon.style.background = def.iconBg;
            icon.innerHTML = def.glyph;
        }
        return icon;
    }
    PhoneOS.appIcon = iconEl;

    function slot(def) {
        const s = el('div', 'app-slot' + (def.soon ? ' soon' : ''));
        s.dataset.app = def.id;
        s.append(iconEl(def), el('div', 'app-label', PhoneOS.appName(def.id)));
        if (def.store) {
            const minus = el('button', 'app-remove', '−');
            minus.type = 'button';
            minus.addEventListener('click', (e) => { e.stopPropagation(); removeApp(def); });
            s.append(minus);
        }

        let holdTimer = null;
        let held = false;
        let downAt = null;
        const cancelHold = () => {
            clearTimeout(holdTimer);
            holdTimer = null;
            if (cancelActiveHold === cancelHold) cancelActiveHold = null;
        };
        s.addEventListener('pointerdown', (e) => {
            held = false;
            downAt = { x: e.clientX, y: e.clientY };
            if (editing) { startDrag(e, s, def); return; }
            holdTimer = setTimeout(() => { held = true; cancelActiveHold = null; resetPaging(); contextMenu(def, s); }, 480);
            cancelActiveHold = cancelHold;
        });
        s.addEventListener('pointermove', (e) => {
            if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) cancelHold();
        });
        s.addEventListener('pointerup', cancelHold);
        s.addEventListener('pointercancel', cancelHold);
        s.addEventListener('click', (e) => {
            if (held || suppress || editing) { e.preventDefault(); e.stopPropagation(); held = false; return; }
            PhoneOS.router.openApp(def.id, s);
        });
        return s;
    }

    function contextMenu(def, s) {
        PhoneOS.sounds.tick();
        const scrim = el('div', 'ctx-scrim');
        const menu = el('div', 'ctx-menu');
        const lifted = iconEl(def);
        lifted.classList.add('ctx-icon');
        const screen = $('phone-screen');
        const sr = screen.getBoundingClientRect();
        const scale = sr.width / screen.offsetWidth || 1;
        const ir = s.querySelector('.app-icon').getBoundingClientRect();
        const left = (ir.left - sr.left) / scale;
        const top = (ir.top - sr.top) / scale;
        lifted.style.left = left + 'px';
        lifted.style.top = top + 'px';

        const close = () => { scrim.remove(); menu.remove(); lifted.remove(); };
        const item = (label, fn, danger) => {
            const b = el('button', 'ctx-item' + (danger ? ' danger' : ''), label);
            b.type = 'button';
            b.addEventListener('click', (e) => { e.stopPropagation(); close(); fn(); });
            menu.append(b);
        };
        for (const a of QUICK[def.id] || []) item(a.label, () => PhoneOS.router.openApp(def.id, s, a.params));
        item('Edit Home Screen', () => startEditing());
        if (def.store) item('Remove App', () => removeApp(def), true);

        scrim.addEventListener('click', close);
        screen.append(scrim, lifted, menu);
        const below = top + 70;
        const mh = menu.offsetHeight;
        const sh = screen.offsetHeight;
        menu.style.top = (below + mh > sh - 30 ? Math.max(60, top - mh - 12) : below) + 'px';
        menu.style.left = Math.min(Math.max(12, left - 6), screen.offsetWidth - menu.offsetWidth - 12) + 'px';
        menu.classList.add('in');
    }

    async function removeApp(def) {
        const view = $('phone-screen');
        if (!await PhoneOS.ui.confirm(view, `Remove “${PhoneOS.appName(def.id)}”? You can get it back from the App Store.`, 'Remove App')) return;
        const res = await PhoneOS.api('store:uninstall', { id: def.id });
        if (res && res.ok) {
            PhoneOS.state.installedApps = res.data.installed;
            build();
        }
    }

    function nextAlarm(list) {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        let best = null;
        for (const a of list || []) {
            if (!a.enabled) continue;
            const [h, m] = String(a.time).split(':').map(Number);
            let at = h * 60 + m;
            if (at <= minutes) at += 1440;
            if (!best || at < best.at) best = { at, time: a.time, label: a.label };
        }
        return best;
    }

    async function alarms() {
        if (alarmCache && Date.now() - alarmCache.at < 60000) return alarmCache.list;
        const res = await PhoneOS.api('alarms:list');
        alarmCache = { at: Date.now(), list: (res && res.ok && res.data) || [] };
        return alarmCache.list;
    }

    function fmtAlarm(t) {
        const [h, m] = String(t).split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return PhoneOS.clock.timeString(d);
    }

    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    function stackCards() {
        const cards = [];
        if (valet && valet.phase === 'coming') {
            const c = el('div', 'ss-card ss-valet');
            const top = el('div', 'ss-valet-top');
            const ic = el('div', 'ss-valet-ic');
            ic.innerHTML = PhoneOS.glyphs.garage;
            const t = el('div', 'ss-valet-title', 'Valet');
            top.append(ic, t);
            const eta = el('div', 'ss-big', valet.eta >= 60 ? Math.round(valet.eta / 60) + ' min' : Math.max(1, valet.eta) + ' s');
            const sub = el('div', 'ss-sub', (valet.label || 'Your car') + ' is on the way');
            const track = el('div', 'ss-progress');
            const fill = el('div', 'ss-progress-fill');
            fill.style.width = Math.min(96, Math.max(6, 100 - (valet.dist || 0) / 4)) + '%';
            track.append(fill);
            c.append(top, eta, sub, track);
            c.addEventListener('click', () => PhoneOS.router.openApp('garage'));
            cards.push(c);
        }

        const wx = el('div', 'ss-card ss-weather');
        const wl = el('div', 'ss-col');
        wl.append(el('div', 'ss-label', 'Los Santos'), el('div', 'ss-big ss-temp', '--°'));
        const wr = el('div', 'ss-col ss-right');
        const wi = el('div', 'ss-wx-icon', '·');
        wr.append(wi, el('div', 'ss-sub ss-wx-label', ''), el('div', 'ss-sub ss-wx-range', ''));
        wx.append(wl, wr);
        wx.addEventListener('click', () => PhoneOS.router.openApp('weather'));
        if (PhoneOS.weatherSummary) {
            PhoneOS.weatherSummary().then((s) => {
                if (!s) return;
                wx.querySelector('.ss-temp').textContent = s.temp + '°';
                wi.textContent = s.icon;
                wx.querySelector('.ss-wx-label').textContent = s.label;
                wx.querySelector('.ss-wx-range').textContent = `H:${s.temp + 3}° L:${s.temp - 5}°`;
            }).catch(() => {});
        }
        cards.push(wx);

        const cal = el('div', 'ss-card ss-calendar');
        const now = new Date();
        const left = el('div', 'ss-col');
        left.append(el('div', 'ss-day', DAYS[now.getDay()]), el('div', 'ss-date', String(now.getDate())));
        const right = el('div', 'ss-col ss-alarm');
        const at = el('div', 'ss-label', 'Next alarm');
        const time = el('div', 'ss-alarm-time', '—');
        const note = el('div', 'ss-sub', '');
        right.append(at, time, note);
        cal.append(left, right);
        cal.addEventListener('click', () => PhoneOS.router.openApp('clock'));
        alarms().then((list) => {
            const n = nextAlarm(list);
            time.textContent = n ? fmtAlarm(n.time) : 'None';
            note.textContent = n ? (n.label || 'Alarm') : 'Set one in Clock';
        }).catch(() => {});
        cards.push(cal);

        const playing = PhoneOS.musicNow && PhoneOS.musicNow();
        const mus = el('div', 'ss-card ss-music');
        const art = el('div', 'ss-art');
        art.innerHTML = PhoneOS.glyphs.music;
        const ml = el('div', 'ss-col');
        ml.append(el('div', 'ss-label', playing ? 'Now Playing' : 'Music'),
            el('div', 'ss-track-name', playing ? playing.title : 'Not Playing'));
        mus.append(art, ml);
        mus.addEventListener('click', () => PhoneOS.router.openApp('music'));
        cards.push(mus);
        return cards;
    }

    function smartStack() {
        const box = el('div', 'widget-stack lg');
        const viewport = el('div', 'ss-viewport');
        const track = el('div', 'ss-track');
        const dots = el('div', 'ss-dots');
        const cards = stackCards();
        stackIndex = Math.min(stackIndex, cards.length - 1);
        for (const c of cards) track.append(c);
        for (let i = 0; i < cards.length; i++) dots.append(el('span'));
        viewport.append(track);
        box.append(viewport, dots);

        const show = (i, animate) => {
            stackIndex = (i + cards.length) % cards.length;
            track.style.transition = animate === false ? 'none' : '';
            track.style.transform = `translateY(${-stackIndex * 100}%)`;
            [...dots.children].forEach((d, k) => d.classList.toggle('on', k === stackIndex));
        };
        show(stackIndex, false);

        let sy = null;
        box.addEventListener('pointerdown', (e) => {
            if (editing) return;
            e.stopPropagation();
            sy = e.clientY;
        });
        box.addEventListener('pointerup', (e) => {
            if (sy === null) return;
            const dy = e.clientY - sy;
            sy = null;
            if (Math.abs(dy) > 24) {
                suppressClick();
                show(stackIndex + (dy < 0 ? 1 : -1));
            }
        });
        box.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (Math.abs(e.deltaY) < 10) return;
            show(stackIndex + (e.deltaY > 0 ? 1 : -1));
        }, { passive: false });

        clearInterval(stackTimer);
        stackTimer = setInterval(() => {
            if (!document.body.contains(box)) { clearInterval(stackTimer); return; }
            if (!editing && !(valet && valet.phase === 'coming')) show(stackIndex + 1);
        }, 9000);
        return box;
    }

    function suppressClick() {
        suppress = true;
        setTimeout(() => { suppress = false; }, 300);
    }

    function renderPage(i) {
        const p = el('div', 'home-page');
        p.dataset.page = i;
        if (i === 0) p.append(smartStack());
        const grid = el('div', 'home-grid');
        for (const id of pages[i]) {
            const def = PhoneOS.getApp(id);
            if (def) grid.append(slot(def));
        }
        p.append(grid);
        return p;
    }

    function paintSearch() {
        const pill = $('home-search');
        pill.textContent = '';
        if (pages.length > 1) {
            pill.classList.add('dots');
            for (let i = 0; i < pages.length; i++) pill.append(el('span', i === page ? 'on' : ''));
        } else {
            pill.classList.remove('dots');
            const icon = el('span', 'hs-icon');
            icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>';
            pill.append(icon, el('span', 'hs-label', 'Search'));
        }
    }

    function go(i, animate) {
        page = Math.max(0, Math.min(pages.length - 1, i));
        const track = $('home-track');
        track.style.transition = animate === false ? 'none' : '';
        track.style.transform = `translateX(${-page * width()}px)`;
        paintSearch();
        setTimeout(() => PhoneOS.glass.sync(), animate === false ? 0 : 380);
    }

    function build() {
        if (!PhoneOS.state) return;
        pages = computePages();
        const track = $('home-track');
        track.textContent = '';
        pages.forEach((_, i) => track.append(renderPage(i)));
        const dock = $('dock');
        dock.textContent = '';
        for (const def of PhoneOS.apps) {
            if (def.dock && visible(def)) dock.append(slot(def));
        }
        go(Math.min(page, pages.length - 1), false);
        renderBadges();
        $('homescreen').classList.toggle('editing', editing);
        PhoneOS.glass.sync();
    }

    function renderBadges() {
        document.querySelectorAll('.app-slot').forEach((s) => {
            const count = PhoneOS.badges[s.dataset.app];
            let badge = s.querySelector('.app-badge');
            if (!count) { if (badge) badge.remove(); return; }
            if (!badge) { badge = el('div', 'app-badge'); s.append(badge); }
            badge.textContent = count > 99 ? '99+' : String(count);
        });
    }

    function startEditing() {
        if (editing) return;
        editing = true;
        $('homescreen').classList.add('editing');
        const done = el('button', 'home-done lg', 'Done');
        done.type = 'button';
        done.id = 'home-done';
        done.addEventListener('click', (e) => { e.stopPropagation(); stopEditing(); });
        $('homescreen').append(done);
        PhoneOS.glass.sync();
    }

    function stopEditing() {
        if (!editing) return;
        editing = false;
        $('homescreen').classList.remove('editing');
        const done = $('home-done');
        if (done) done.remove();
        saveLayout();
    }

    let drag = null;

    function startDrag(e, s, def) {
        e.stopPropagation();
        const screen = $('phone-screen');
        const sr = screen.getBoundingClientRect();
        const scale = sr.width / screen.offsetWidth || 1;
        const ir = s.querySelector('.app-icon').getBoundingClientRect();
        drag = {
            id: def.id, slot: s, scale, sr, moved: false,
            ox: (e.clientX - ir.left) / scale, oy: (e.clientY - ir.top) / scale,
            sx: e.clientX, sy: e.clientY, edgeTimer: null,
        };
        document.addEventListener('pointermove', onDragMove);
        document.addEventListener('pointerup', onDragEnd);
        document.addEventListener('pointercancel', onDragEnd);
    }

    function onDragMove(e) {
        if (!drag) return;
        if (!drag.moved) {
            if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
            drag.moved = true;
            drag.ghost = iconEl(PhoneOS.getApp(drag.id));
            drag.ghost.classList.add('drag-ghost');
            $('phone-screen').append(drag.ghost);
            drag.slot.classList.add('dragging');
        }
        const x = (e.clientX - drag.sr.left) / drag.scale - drag.ox;
        const y = (e.clientY - drag.sr.top) / drag.scale - drag.oy;
        drag.ghost.style.left = x + 'px';
        drag.ghost.style.top = y + 'px';

        const w = $('phone-screen').offsetWidth;
        const px = (e.clientX - drag.sr.left) / drag.scale;
        const edge = px < 18 ? -1 : (px > w - 18 ? 1 : 0);
        if (edge && !drag.edgeTimer) {
            drag.edgeTimer = setTimeout(() => {
                drag.edgeTimer = null;
                const target = page + edge;
                if (target < 0) return;
                movePage(drag.id, target);
            }, 650);
        } else if (!edge && drag.edgeTimer) {
            clearTimeout(drag.edgeTimer);
            drag.edgeTimer = null;
        }

        const under = document.elementsFromPoint(e.clientX, e.clientY)
            .find((n) => n.classList && n.classList.contains('app-slot') && n !== drag.slot && n.closest('.home-grid'));
        if (under) {
            const list = pages[page];
            const from = list.indexOf(drag.id);
            const to = list.indexOf(under.dataset.app);
            if (from >= 0 && to >= 0 && from !== to) {
                list.splice(from, 1);
                list.splice(to, 0, drag.id);
                rerenderPage(page);
            }
        }
    }

    function movePage(id, target) {
        const from = pages.findIndex((p) => p.includes(id));
        if (from < 0) return;
        if (!pages[target]) pages.push([]);
        if (pages[target].length >= capacity(target)) return;
        pages[from].splice(pages[from].indexOf(id), 1);
        pages[target].push(id);
        const track = $('home-track');
        track.textContent = '';
        pages.forEach((_, i) => track.append(renderPage(i)));
        go(target);
        const s = document.querySelector(`.home-page[data-page="${target}"] .app-slot[data-app="${id}"]`);
        if (s && drag) { drag.slot = s; s.classList.add('dragging'); }
    }

    function rerenderPage(i) {
        const old = document.querySelector(`.home-page[data-page="${i}"]`);
        if (!old) return;
        const grid = old.querySelector('.home-grid');
        grid.textContent = '';
        for (const id of pages[i]) {
            const def = PhoneOS.getApp(id);
            if (!def) continue;
            const s = slot(def);
            if (drag && id === drag.id) { s.classList.add('dragging'); drag.slot = s; }
            grid.append(s);
        }
        renderBadges();
    }

    function onDragEnd() {
        document.removeEventListener('pointermove', onDragMove);
        document.removeEventListener('pointerup', onDragEnd);
        document.removeEventListener('pointercancel', onDragEnd);
        if (!drag) return;
        const d = drag;
        drag = null;
        clearTimeout(d.edgeTimer);
        if (d.ghost) d.ghost.remove();
        document.querySelectorAll('.app-slot.dragging').forEach((s) => s.classList.remove('dragging'));
        if (d.moved) {
            pages = pages.filter((p, i) => p.length || i === 0);
            saveLayout();
            build();
        }
    }

    let resetPaging = () => {};

    function initPaging() {
        const area = $('home-pages');
        let start = null;
        resetPaging = () => { start = null; };
        area.addEventListener('pointerdown', (e) => {
            if (drag) return;
            start = { x: e.clientX, y: e.clientY, mode: null };
        });
        area.addEventListener('pointermove', (e) => {
            if (!start || drag) return;
            if (e.buttons === 0) { start = null; return; }
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (!start.mode) {
                if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                    start.mode = 'page';
                    if (cancelActiveHold) cancelActiveHold();
                    try { area.setPointerCapture(e.pointerId); } catch (err) {}
                } else if (Math.abs(dy) > 8) {
                    start.mode = 'none';
                }
            }
            if (start.mode !== 'page') return;
            const screen = $('phone-screen');
            const scale = screen.getBoundingClientRect().width / screen.offsetWidth || 1;
            let off = dx / scale;
            if ((page === 0 && off > 0) || (page === pages.length - 1 && off < 0)) off *= 0.3;
            const track = $('home-track');
            track.style.transition = 'none';
            track.style.transform = `translateX(${-page * width() + off}px)`;
        });
        const end = (e) => {
            if (!start) return;
            const s = start;
            start = null;
            if (s.mode !== 'page') return;
            suppressClick();
            const screen = $('phone-screen');
            const scale = screen.getBoundingClientRect().width / screen.offsetWidth || 1;
            const off = (e.clientX - s.x) / scale;
            const step = off < -width() * 0.18 ? 1 : (off > width() * 0.18 ? -1 : 0);
            go(page + step);
        };
        area.addEventListener('pointerup', end);
        area.addEventListener('pointercancel', end);
        area.addEventListener('click', (e) => {
            if (editing && !e.target.closest('.app-slot')) stopEditing();
        });
        area.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) < 20 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
            go(page + (e.deltaX > 0 ? 1 : -1));
        });

        $('home-search').addEventListener('click', (e) => {
            e.stopPropagation();
            if (editing) { stopEditing(); return; }
            if (PhoneOS.spotlight) PhoneOS.spotlight.show();
        });
    }

    document.addEventListener('DOMContentLoaded', initPaging);

    PhoneOS.on('phone:valet', (data) => {
        const was = valet;
        valet = data && data.phase === 'coming' ? data : null;
        const card = document.querySelector('.ss-valet');
        if (valet && was && card) {
            card.querySelector('.ss-big').textContent = valet.eta >= 60 ? Math.round(valet.eta / 60) + ' min' : Math.max(1, valet.eta) + ' s';
            card.querySelector('.ss-progress-fill').style.width = Math.min(96, Math.max(6, 100 - (valet.dist || 0) / 4)) + '%';
            return;
        }
        if (valet && !was) stackIndex = 0;
        const stack = document.querySelector('.widget-stack');
        if (stack && !editing) {
            stack.replaceWith(smartStack());
            PhoneOS.glass.sync();
        }
    });

    PhoneOS.on('phone:close', () => { if (editing) stopEditing(); });

    return {
        build, renderBadges, startEditing, stopEditing,
        isEditing: () => editing,
        page: () => page,
        go,
    };
})();

PhoneOS.rebuildHome = () => PhoneOS.home.build();
PhoneOS.renderBadges = () => PhoneOS.home.renderBadges();
PhoneOS.paintWidgetClock = () => {
    const d = document.querySelector('.ss-calendar .ss-date');
    if (d) d.textContent = String(new Date().getDate());
};
