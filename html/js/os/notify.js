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

    function renderLockPreviews() {
        const box = document.getElementById('ls-notifs');
        box.textContent = '';
        for (const n of PhoneOS.notifications.slice(0, 3)) box.append(card(n, true));
    }

    function toast(n) {
        const el = card(n);
        const layer = document.getElementById('toasts');
        layer.append(el);
        setTimeout(() => el.classList.add('out'), 3600);
        setTimeout(() => el.remove(), 3950);
    }

    PhoneOS.notify = function (n) {
        n = { app: n.app, title: n.title, body: n.body, at: Date.now() };
        const dnd = PhoneOS.state && PhoneOS.state.settings.dnd;

        PhoneOS.notifications.unshift(n);
        if (PhoneOS.notifications.length > 50) PhoneOS.notifications.pop();

        if (!dnd) {
            toast(n);
            PhoneOS.sounds.playText(PhoneOS.state && PhoneOS.state.settings.texttone);
        }
        if (PhoneOS.bumpBadge) PhoneOS.bumpBadge(n.app);
        renderCenter();
        renderLockPreviews();
    };

    PhoneOS.on('phone:notify', (n) => PhoneOS.notify(n));

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
