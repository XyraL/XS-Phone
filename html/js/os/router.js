PhoneOS.freshRender = function (view) {
    const gen = String((PhoneOS._renderGen = (PhoneOS._renderGen || 0) + 1));
    view.dataset.gen = gen;
    return () => view.dataset.gen === gen && document.body.contains(view);
};

PhoneOS.router = (() => {
    let currentApp = null;

    function openApp(id, slotEl, params) {
        const def = PhoneOS.getApp(id);
        if (!def) return;

        if (def.soon) {
            if (slotEl) {
                slotEl.classList.remove('bounce');
                void slotEl.offsetWidth; // restart the animation
                slotEl.classList.add('bounce');
            }
            return;
        }

        const layer = document.getElementById('app-layer');
        if (currentApp && currentApp.onClose) currentApp.onClose();
        layer.textContent = '';

        if (slotEl) {
            const s = slotEl.getBoundingClientRect();
            const p = document.getElementById('phone-screen').getBoundingClientRect();
            layer.style.transformOrigin =
                `${s.left + s.width / 2 - p.left}px ${s.top + s.height / 2 - p.top}px`;
        } else {
            layer.style.transformOrigin = '';
        }

        const view = document.createElement('div');
        view.className = 'app-view';
        view.dataset.app = id;
        layer.append(view);

        layer.classList.remove('hidden');
        document.getElementById('homescreen').classList.add('hidden');

        currentApp = def;
        PhoneOS.clearBadge(id);
        def.render(view, params);
    }

    function home() {
        if (currentApp && currentApp.onClose) currentApp.onClose();
        const layer = document.getElementById('app-layer');
        layer.classList.add('hidden');
        layer.textContent = '';
        currentApp = null;
        if (!PhoneOS.shell.isLocked()) {
            document.getElementById('homescreen').classList.remove('hidden');
        }
    }

    function current() {
        return currentApp;
    }

    return { openApp, home, current };
})();
