PhoneOS.notifications = [];

(() => {
    function card(n, onLock) {
        const el = document.createElement('div');
        el.className = 'notif-card';

        const app = PhoneOS.getApp ? PhoneOS.getApp(n.app) : null;

        const icon = document.createElement('div');
        icon.className = 'n-icon';
        icon.style.background = app ? app.iconBg : 'linear-gradient(135deg,#8e8e93,#636366)';
        if (app) icon.innerHTML = app.glyph;

        const body = document.createElement('div');
        body.className = 'n-body';

        const title = document.createElement('div');
        title.className = 'n-title';
        const titleText = document.createElement('span');
        titleText.textContent = n.title || (app ? app.name : 'Notification');
        const time = document.createElement('span');
        time.className = 'n-time';
        time.textContent = PhoneOS.clock.timeString(new Date(n.at));
        title.append(titleText, time);

        const text = document.createElement('div');
        text.className = 'n-text';
        const hideBody = onLock && PhoneOS.state && !PhoneOS.state.settings.lockPreviews;
        text.textContent = hideBody ? 'Notification' : (n.body || '');

        body.append(title, text);
        el.append(icon, body);
        return el;
    }

    function renderCenter() {
        const list = document.getElementById('nc-list');
        list.textContent = '';
        if (!PhoneOS.notifications.length) {
            const empty = document.createElement('div');
            empty.className = 'nc-empty';
            empty.textContent = 'No notifications';
            list.append(empty);
            return;
        }
        for (const n of PhoneOS.notifications) list.append(card(n));
    }

    // Swipe a lock-screen card sideways to clear it. The lock screen captures
    // pointers for swipe-to-unlock, so the card stops propagation and handles a
    // plain tap itself (tap still unlocks, like tapping anywhere else).
    function attachSwipe(el, n) {
        let startX = null;
        let dx = 0;
        el.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            startX = e.clientX;
            dx = 0;
            el.style.transition = 'none';
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
        });
        el.addEventListener('pointermove', (e) => {
            if (startX === null) return;
            dx = e.clientX - startX;
            el.style.transform = `translateX(${dx}px)`;
            el.style.opacity = String(Math.max(0.15, 1 - Math.abs(dx) / 220));
        });
        const end = (e) => {
            if (startX === null) return;
            e.stopPropagation();
            startX = null;
            if (Math.abs(dx) > 90) {
                el.style.transition = 'transform 0.18s, opacity 0.18s';
                el.style.transform = `translateX(${dx > 0 ? 420 : -420}px)`;
                el.style.opacity = '0';
                setTimeout(() => {
                    const i = PhoneOS.notifications.indexOf(n);
                    if (i >= 0) PhoneOS.notifications.splice(i, 1);
                    renderCenter();
                    renderLockPreviews();
                }, 180);
            } else {
                el.style.transition = 'transform 0.2s, opacity 0.2s';
                el.style.transform = '';
                el.style.opacity = '';
                if (Math.abs(dx) < 8 && PhoneOS.shell) PhoneOS.shell.unlock();
            }
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
    }

    function renderLockPreviews() {
        const box = document.getElementById('ls-notifs');
        box.textContent = '';
        for (const n of PhoneOS.notifications.slice(0, 3)) {
            const el = card(n, true);
            attachSwipe(el, n);
            box.append(el);
        }
    }

    function callIsUp() {
        const call = document.getElementById('call-overlay');
        return !!call && !call.classList.contains('hidden');
    }

    function toast(n) {
        if (callIsUp()) return;
        const el = card(n);
        const layer = document.getElementById('toasts');
        layer.append(el);
        setTimeout(() => el.classList.add('out'), 3600);
        setTimeout(() => el.remove(), 3950);
    }

    // Phone is closed → slide it up from the bottom edge just far enough to show
    // the banner on the lock screen, then tuck it back away. A second notification
    // while peeking just extends the hold.
    let peekTimer = null;
    let peekHide = null;
    function endPeek() {
        clearTimeout(peekTimer);
        clearTimeout(peekHide);
        peekTimer = peekHide = null;
        document.getElementById('phone-root').classList.remove('peek-in', 'peek-out');
    }
    PhoneOS.endPeek = endPeek;

    function peek() {
        const root = document.getElementById('phone-root');
        const call = document.getElementById('call-overlay');
        if (call && !call.classList.contains('hidden')) return;
        clearTimeout(peekTimer);
        clearTimeout(peekHide);
        root.classList.remove('hidden');
        if (!root.classList.contains('peek-in')) {
            root.classList.add('peek-out');
            void root.offsetWidth;
            root.classList.remove('peek-out');
            root.classList.add('peek-in');
        }
        peekTimer = setTimeout(() => {
            root.classList.remove('peek-in');
            root.classList.add('peek-out');
            peekHide = setTimeout(() => {
                root.classList.remove('peek-out');
                root.classList.add('hidden');
                peekTimer = peekHide = null;
            }, 420);
        }, 3600);
    }

    PhoneOS.notify = function (n) {
        n = { app: n.app, title: n.title, body: n.body, at: Date.now() };
        const dnd = PhoneOS.state && PhoneOS.state.settings.dnd;

        PhoneOS.notifications.unshift(n);
        if (PhoneOS.notifications.length > 50) PhoneOS.notifications.pop();

        if (!dnd) {
            toast(n);
            PhoneOS.sounds.playText(PhoneOS.state && PhoneOS.state.settings.texttone);
            if (typeof PhoneOS.isOpen === 'function' && !PhoneOS.isOpen()) peek();
        }
        if (PhoneOS.bumpBadge) PhoneOS.bumpBadge(n.app);
        renderCenter();
        renderLockPreviews();
    };

    PhoneOS.on('phone:notify', (n) => PhoneOS.notify(n));
    PhoneOS.on('phone:open', renderLockPreviews);

    document.addEventListener('DOMContentLoaded', () => {
        const center = document.getElementById('notif-center');

        document.getElementById('statusbar').addEventListener('click', () => {
            center.classList.toggle('hidden');
            if (!center.classList.contains('hidden')) renderCenter();
        });
        center.addEventListener('click', (e) => {
            if (e.target.id !== 'nc-clear') center.classList.add('hidden');
        });
        document.getElementById('nc-clear').addEventListener('click', () => {
            PhoneOS.notifications = [];
            if (PhoneOS.clearBadges) PhoneOS.clearBadges();
            renderCenter();
            renderLockPreviews();
        });
    });
})();
