PhoneOS.island = (() => {
    const PRIORITY = { call: 3, timer: 2, music: 1 };
    const activities = new Map();
    let ticker = null;

    const node = () => document.querySelector('.island');

    function top() {
        let best = null;
        for (const [key, src] of activities) {
            if (!best || (PRIORITY[key] || 0) > (PRIORITY[best.key] || 0)) best = { key, src };
        }
        return best;
    }

    function bars() {
        const wrap = document.createElement('div');
        wrap.className = 'isl-bars';
        for (let i = 0; i < 3; i++) wrap.append(document.createElement('span'));
        return wrap;
    }

    function paint() {
        const el = node();
        if (!el) return;

        const best = top();
        if (!best) {
            el.className = 'island';
            el.textContent = '';
            el.onclick = null;
            return;
        }

        const d = typeof best.src === 'function' ? best.src() : best.src;
        if (!d) { clear(best.key); return; }

        el.className = 'island live island-' + best.key;
        el.textContent = '';

        const icon = document.createElement('div');
        icon.className = 'isl-icon';
        if (d.iconBg) icon.style.background = d.iconBg;
        if (d.icon) icon.innerHTML = d.icon;

        const body = document.createElement('div');
        body.className = 'isl-body';
        const title = document.createElement('div');
        title.className = 'isl-title';
        title.textContent = d.title || '';
        const sub = document.createElement('div');
        sub.className = 'isl-sub';
        sub.textContent = d.subtitle || '';
        body.append(title, sub);

        const right = document.createElement('div');
        right.className = 'isl-right';
        if (d.right === 'bars') right.append(bars());
        else if (d.right) right.textContent = d.right;

        el.append(icon, body, right);
        el.onclick = d.onTap || null;
        el.style.cursor = d.onTap ? 'pointer' : '';
    }

    // Only runs while something on the island reports live-changing text, so an
    // idle phone is not repainting the DOM once a second for nothing.
    function retime() {
        const needs = [...activities.values()].some((s) => typeof s === 'function');
        if (needs && !ticker) ticker = setInterval(paint, 1000);
        if (!needs && ticker) { clearInterval(ticker); ticker = null; }
    }

    function show(key, src) {
        activities.set(key, src);
        retime();
        paint();
    }

    function clear(key) {
        if (!activities.delete(key)) return;
        retime();
        paint();
    }

    function clearAll() {
        activities.clear();
        retime();
        paint();
    }

    PhoneOS.on('phone:close', clearAll);

    return { show, clear, clearAll, has: (k) => activities.has(k) };
})();
