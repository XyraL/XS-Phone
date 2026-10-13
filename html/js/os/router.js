PhoneOS.freshRender = function (view) {
    const gen = String((PhoneOS._renderGen = (PhoneOS._renderGen || 0) + 1));
    view.dataset.gen = gen;
    return () => view.dataset.gen === gen && document.body.contains(view);
};

PhoneOS.router = (() => {
    let currentApp = null;
    let openSeq = 0;

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
        closeSeq++;
        layer.classList.remove('closing');
        layer.textContent = '';

        const view = document.createElement('div');
        view.className = 'app-view';
        view.dataset.app = id;
        layer.append(view);

        const wasHidden = layer.classList.contains('hidden');
        layer.classList.remove('hidden');
        const seq = ++openSeq;
        if (wasHidden && PhoneOS.motion) {
            PhoneOS.motion.open(layer, slotEl, id);
            setTimeout(() => {
                if (seq === openSeq) document.getElementById('homescreen').classList.add('hidden');
            }, 470);
        } else {
            document.getElementById('homescreen').classList.add('hidden');
            document.getElementById('phone-screen').classList.add('app-open');
        }

        currentApp = def;
        PhoneOS.clearBadge(id);
        def.render(view, params);
    }

    let closeSeq = 0;

    function home() {
        const closing = currentApp;
        if (currentApp && currentApp.onClose) currentApp.onClose();
        const layer = document.getElementById('app-layer');
        currentApp = null;
        openSeq++;
        if (!PhoneOS.shell.isLocked()) {
            document.getElementById('homescreen').classList.remove('hidden');
        }

        const seq = ++closeSeq;
        if (layer.classList.contains('hidden') || !layer.children.length) {
            layer.classList.add('hidden');
            layer.textContent = '';
            document.getElementById('phone-screen').classList.remove('app-open');
            return;
        }
        const finish = () => {
            if (seq !== closeSeq) return;
            layer.classList.add('hidden');
            layer.textContent = '';
        };
        if (PhoneOS.motion && !PhoneOS.shell.isLocked()) {
            PhoneOS.motion.close(layer, closing && closing.id, finish);
            if (PhoneOS.glass) PhoneOS.glass.sync();
            return;
        }
        document.getElementById('phone-screen').classList.remove('app-open');
        finish();
    }

    function current() {
        return currentApp;
    }

    return { openApp, home, current };
})();
