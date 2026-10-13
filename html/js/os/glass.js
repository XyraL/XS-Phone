PhoneOS.glass = (() => {
    let frame = null;
    let photo = null;

    const screen = () => document.getElementById('phone-screen');

    function coverFor(url, done) {
        if (photo && photo.url === url && photo.w) { done(photo); return; }
        const img = new Image();
        img.onload = () => {
            photo = { url, w: img.naturalWidth, h: img.naturalHeight };
            done(photo);
        };
        img.onerror = () => done(null);
        img.src = url;
    }

    function wallpaper(url) {
        const el = screen();
        if (!url) {
            el.style.removeProperty('--wp-img');
            el.style.removeProperty('--wp-size');
            el.style.removeProperty('--wp-ox');
            el.style.removeProperty('--wp-oy');
            el.style.backgroundImage = '';
            sync();
            return;
        }
        const safe = String(url).replace(/"/g, '%22');
        el.style.setProperty('--wp-img', `url("${safe}")`);
        coverFor(safe, (p) => {
            if (!p) return;
            const sw = el.offsetWidth;
            const sh = el.offsetHeight;
            const scale = Math.max(sw / p.w, sh / p.h);
            const w = p.w * scale;
            const h = p.h * scale;
            el.style.setProperty('--wp-size', `${w}px ${h}px`);
            el.style.setProperty('--wp-ox', `${(sw - w) / 2}px`);
            el.style.setProperty('--wp-oy', `${(sh - h) / 2}px`);
            sync();
        });
    }

    function sync() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            const el = screen();
            if (!el) return;
            const sr = el.getBoundingClientRect();
            const scale = el.offsetWidth ? sr.width / el.offsetWidth : 1;
            el.style.setProperty('--sw', el.offsetWidth + 'px');
            el.style.setProperty('--sh', el.offsetHeight + 'px');
            for (const g of el.querySelectorAll('.lg')) {
                const r = g.getBoundingClientRect();
                if (!r.width) continue;
                g.style.setProperty('--gx', ((r.left - sr.left) / scale).toFixed(1) + 'px');
                g.style.setProperty('--gy', ((r.top - sr.top) / scale).toFixed(1) + 'px');
            }
        });
    }

    window.addEventListener('resize', sync);
    PhoneOS.on('phone:open', () => setTimeout(sync, 60));

    return { sync, wallpaper };
})();
