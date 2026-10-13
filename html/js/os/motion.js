PhoneOS.motion = (() => {
    const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
    const screen = () => document.getElementById('phone-screen');

    function scaleOf(s) {
        return s.offsetWidth ? s.getBoundingClientRect().width / s.offsetWidth : 1;
    }

    function rectIn(el) {
        const s = screen();
        const sr = s.getBoundingClientRect();
        const k = scaleOf(s);
        const r = el.getBoundingClientRect();
        return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
    }

    function iconFor(id) {
        const page = PhoneOS.home ? PhoneOS.home.page() : 0;
        const dock = document.querySelector(`#dock .app-slot[data-app="${id}"] .app-icon`);
        if (dock) return dock;
        return document.querySelector(`.home-page[data-page="${page}"] .app-slot[data-app="${id}"] .app-icon`);
    }

    function clipFrom(r, s) {
        const W = s.offsetWidth;
        const H = s.offsetHeight;
        return `inset(${r.y}px ${W - r.x - r.w}px ${H - r.y - r.h}px ${r.x}px round 17px)`;
    }

    function open(layer, slotEl, id) {
        const s = screen();
        s.classList.add('app-open');
        const icon = (slotEl && slotEl.querySelector('.app-icon')) || (id && iconFor(id));
        if (!icon || !icon.offsetParent) {
            layer.animate([
                { opacity: 0, transform: 'scale(0.94)' },
                { opacity: 1, transform: 'none' },
            ], { duration: 300, easing: EASE });
            return;
        }
        const r = rectIn(icon);
        layer.animate([
            { clipPath: clipFrom(r, s), opacity: 0.5 },
            { clipPath: 'inset(0px 0px 0px 0px round 52px)', opacity: 1 },
        ], { duration: 460, easing: EASE });
    }

    function close(layer, id, done) {
        const s = screen();
        s.classList.remove('app-open');
        const icon = id && iconFor(id);
        let anim;
        if (icon && icon.offsetParent) {
            const r = rectIn(icon);
            anim = layer.animate([
                { clipPath: 'inset(0px 0px 0px 0px round 52px)', opacity: 1 },
                { clipPath: clipFrom(r, s), opacity: 0.2 },
            ], { duration: 360, easing: EASE, fill: 'forwards' });
            icon.animate([{ transform: 'scale(0.86)' }, { transform: 'scale(1.06)' }, { transform: 'none' }],
                { duration: 520, easing: 'ease-out', delay: 180 });
        } else {
            anim = layer.animate([
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: 'scale(0.88)' },
            ], { duration: 260, easing: EASE, fill: 'forwards' });
        }
        anim.onfinish = () => {
            done();
            anim.cancel();
        };
    }

    let swipe = null;

    function onDown(e) {
        const layer = document.getElementById('app-layer');
        if (!layer || layer.classList.contains('hidden')) return;
        const s = screen();
        const k = scaleOf(s);
        const x = (e.clientX - s.getBoundingClientRect().left) / k;
        if (x > 22) return;
        if (e.target.closest('input, textarea, .leaflet-container, .picker-overlay, .confirm-overlay, #call-overlay, .camera-view')) return;
        const view = layer.querySelector('.app-view');
        const back = view && view.querySelector('.ah-back');
        if (!back) return;
        swipe = { x: e.clientX, k, view, back, w: s.offsetWidth, dx: 0, live: false };
    }

    function onMove(e) {
        if (!swipe) return;
        const dx = Math.max(0, (e.clientX - swipe.x) / swipe.k);
        if (!swipe.live && dx < 8) return;
        swipe.live = true;
        swipe.dx = dx;
        swipe.view.style.transition = 'none';
        swipe.view.style.transform = `translateX(${dx}px)`;
        swipe.view.style.boxShadow = '-14px 0 30px rgba(0, 0, 0, 0.28)';
    }

    function onUp() {
        if (!swipe) return;
        const sw = swipe;
        swipe = null;
        if (!sw.live) return;
        const view = sw.view;
        view.style.transition = `transform 0.24s ${EASE}`;
        if (sw.dx > sw.w * 0.3) {
            view.style.transform = `translateX(${sw.w}px)`;
            setTimeout(() => {
                view.style.transition = 'none';
                view.style.transform = '';
                view.style.boxShadow = '';
                sw.back.click();
                view.animate([
                    { transform: 'translateX(-26%)', opacity: 0.65 },
                    { transform: 'none', opacity: 1 },
                ], { duration: 300, easing: EASE });
            }, 200);
        } else {
            view.style.transform = '';
            setTimeout(() => { view.style.boxShadow = ''; view.style.transition = ''; }, 250);
        }
    }

    function onScroll(e) {
        const c = e.target;
        if (!c.classList || !c.classList.contains('app-content')) return;
        const view = c.closest('.app-view');
        const header = view && view.querySelector('.app-header');
        if (header && header.querySelector('.ah-title')) header.classList.toggle('compact', c.scrollTop > 26);
    }

    function watchSheets() {
        const s = screen();
        const paint = () => {
            const open = [...s.children].some((n) => n.classList
                && (n.classList.contains('picker-overlay') || n.classList.contains('confirm-overlay')));
            s.classList.toggle('sheet-open', open);
        };
        new MutationObserver(paint).observe(s, { childList: true });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', onUp, true);
        document.addEventListener('scroll', onScroll, true);
        watchSheets();
    });

    return { open, close };
})();
