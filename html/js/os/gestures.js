// Edge swipes for the shell. Deliberately narrow: gestures only start in the
// top/bottom edge strips or on empty home-screen space, so they never steal a
// drag from the lock screen, a notification card, the camera viewfinder or a
// Sparks card — all of which run their own pointer handlers.
(() => {
    const EDGE = 46;
    const THRESHOLD = 44;
    let start = null;
    let suppressClick = false;

    const screen = () => document.getElementById('phone-screen');

    function busyTarget(t) {
        return !!(t.closest && t.closest(
            '.notif-card, .cc-panel, .sp-overlay, .pin-overlay, .picker-overlay, ' +
            '#call-overlay, .camera-view, input, textarea, [data-gallery-item]'
        ));
    }

    function zoneFor(e, rect) {
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        if (y <= EDGE) return x > rect.width * 0.55 ? 'top-right' : 'top-left';
        if (rect.height - y <= EDGE) return 'bottom';
        const home = document.getElementById('homescreen');
        if (home && !home.classList.contains('hidden')) return 'home';
        return null;
    }

    function onDown(e) {
        start = null;
        if (!PhoneOS.state || PhoneOS.shell.isLocked()) return;
        if (busyTarget(e.target)) return;
        const rect = screen().getBoundingClientRect();
        const zone = zoneFor(e, rect);
        if (!zone) return;
        start = { x: e.clientX, y: e.clientY, zone };
    }

    function onUp(e) {
        if (!start) return;
        const { x, y, zone } = start;
        start = null;
        const dx = e.clientX - x;
        const dy = e.clientY - y;
        if (Math.abs(dx) > Math.abs(dy)) return;       // horizontal: not ours
        if (Math.abs(dy) < THRESHOLD) return;          // a tap, leave it alone

        const down = dy > 0;
        let acted = false;

        if (zone === 'bottom' && !down) {
            // Swipe up from the bottom bar: dismiss whatever is over the phone,
            // otherwise go home.
            const nc = document.getElementById('notif-center');
            if (PhoneOS.controlCenter.isOpen()) PhoneOS.controlCenter.hide();
            else if (PhoneOS.spotlight.isOpen()) PhoneOS.spotlight.hide();
            else if (nc && !nc.classList.contains('hidden')) nc.classList.add('hidden');
            else PhoneOS.router.home();
            acted = true;
        } else if (zone === 'top-right' && down) {
            PhoneOS.controlCenter.show();
            acted = true;
        } else if (zone === 'top-left' && down) {
            document.getElementById('notif-center').classList.remove('hidden');
            acted = true;
        } else if (zone === 'home' && down) {
            PhoneOS.spotlight.show();
            acted = true;
        } else if (zone !== 'bottom' && !down && PhoneOS.controlCenter.isOpen()) {
            PhoneOS.controlCenter.hide();
            acted = true;
        }

        if (acted) {
            // A swipe that began on an app icon must not also launch the app.
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 350);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const el = screen();
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', () => { start = null; });
        el.addEventListener('click', (e) => {
            if (!suppressClick) return;
            e.stopPropagation();
            e.preventDefault();
        }, true);
    });
})();
