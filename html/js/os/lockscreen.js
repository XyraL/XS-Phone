PhoneOS.lockscreen = (() => {
    let ticker = null;
    let alarm = null;

    const $ = (id) => document.getElementById(id);

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    function batteryPct() {
        const fill = $('sb-batt-fill');
        const w = fill ? Number(fill.getAttribute('width')) : 19;
        return Math.max(1, Math.min(100, Math.round(w / 19 * 100)));
    }

    function ring(pct) {
        const svg = '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" class="lw-ring-bg"/>'
            + `<circle cx="18" cy="18" r="15.5" class="lw-ring" stroke-dasharray="${(pct / 100 * 97.4).toFixed(1)} 97.4"/></svg>`;
        const box = el('div', 'lw-ring-wrap');
        box.innerHTML = svg;
        return box;
    }

    async function nextAlarm() {
        if (alarm && Date.now() - alarm.at < 60000) return alarm.value;
        const res = await PhoneOS.api('alarms:list');
        const list = (res && res.ok && res.data) || [];
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        let best = null;
        for (const a of list) {
            if (!a.enabled) continue;
            const [h, m] = String(a.time).split(':').map(Number);
            let at = h * 60 + m;
            if (at <= minutes) at += 1440;
            if (!best || at < best.at) best = { at, h, m, label: a.label };
        }
        alarm = { at: Date.now(), value: best };
        return best;
    }

    function widgets() {
        const box = $('ls-widgets');
        if (!box) return;
        box.textContent = '';

        const wx = el('div', 'lw lw-circle lg');
        const wxIcon = el('div', 'lw-ic', '☀');
        const wxVal = el('div', 'lw-val', '--°');
        wx.append(wxIcon, wxVal);

        const pct = batteryPct();
        const batt = el('div', 'lw lw-circle lg');
        batt.append(ring(pct), el('div', 'lw-val lw-small', pct + '%'));

        const rect = el('div', 'lw lw-rect lg');
        const t = el('div', 'lw-title', 'Alarm');
        const v = el('div', 'lw-big', '—');
        const sub = el('div', 'lw-sub', 'No alarms set');
        rect.append(t, v, sub);

        box.append(wx, batt, rect);

        if (PhoneOS.weatherSummary) {
            PhoneOS.weatherSummary().then((s) => {
                if (!s) return;
                wxIcon.textContent = s.icon;
                wxVal.textContent = s.temp + '°';
            }).catch(() => {});
        }
        nextAlarm().then((n) => {
            if (!n) return;
            const d = new Date();
            d.setHours(n.h, n.m, 0, 0);
            v.textContent = PhoneOS.clock.timeString(d);
            sub.textContent = n.label || 'Next alarm';
        }).catch(() => {});
    }

    function activity() {
        const box = $('ls-activity');
        if (!box) return;
        const d = PhoneOS.island && PhoneOS.island.current();
        if (!d) {
            if (box.childElementCount) box.textContent = '';
            box.classList.remove('lg', 'on');
            return;
        }
        box.classList.add('lg', 'on');
        box.textContent = '';
        const icon = el('div', 'la-icon');
        if (d.iconBg) icon.style.background = d.iconBg;
        if (d.icon) icon.innerHTML = d.icon;
        const body = el('div', 'la-body');
        body.append(el('div', 'la-title', d.title || ''), el('div', 'la-sub', d.subtitle || ''));
        box.append(icon, body);
        if (d.right && d.right !== 'bars') box.append(el('div', 'la-right', d.right));
        if (typeof d.progress === 'number') {
            const track = el('div', 'la-progress');
            const fill = el('div', 'la-progress-fill');
            fill.style.width = Math.max(4, Math.min(100, d.progress)) + '%';
            track.append(fill);
            box.append(track);
        }
    }

    function refresh() {
        widgets();
        activity();
        clearInterval(ticker);
        ticker = setInterval(() => {
            const ls = $('lockscreen');
            if (!ls || ls.classList.contains('hidden')) return;
            activity();
        }, 1000);
        setTimeout(() => PhoneOS.glass.sync(), 30);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const torch = $('ls-torch');
        torch.addEventListener('pointerdown', (e) => e.stopPropagation());
        torch.addEventListener('click', async (e) => {
            e.stopPropagation();
            PhoneOS.torchOn = !PhoneOS.torchOn;
            torch.classList.toggle('on', PhoneOS.torchOn);
            PhoneOS.sounds.tick();
            const res = await PhoneOS.nui('torch', { on: PhoneOS.torchOn });
            if (res && res.ok === false) {
                PhoneOS.torchOn = false;
                torch.classList.remove('on');
            }
        });
    });

    PhoneOS.on('phone:open', () => setTimeout(refresh, 40));
    PhoneOS.on('phone:valet', () => setTimeout(activity, 0));

    return { refresh, activity };
})();
