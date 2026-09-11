PhoneOS.ui = (() => {
    function header(title, opts = {}) {
        const h = document.createElement('div');
        h.className = 'app-header';

        if (opts.back) {
            const back = document.createElement('button');
            back.className = 'ah-back';
            back.textContent = opts.back.label || 'Back';
            back.addEventListener('click', opts.back.onTap);
            h.append(back);
        } else {
            const t = document.createElement('div');
            t.className = 'ah-title';
            t.textContent = title;
            h.append(t);
        }

        if (opts.action) {
            const btn = document.createElement('button');
            btn.className = 'ah-action';
            btn.textContent = opts.action.label;
            btn.addEventListener('click', opts.action.onTap);
            h.append(btn);
        }
        return h;
    }

    function content() {
        const c = document.createElement('div');
        c.className = 'app-content';
        return c;
    }

    function label(text) {
        const l = document.createElement('div');
        l.className = 'group-label';
        l.textContent = text;
        return l;
    }

    function group(rows) {
        const g = document.createElement('div');
        g.className = 'list-group';
        g.append(...rows);
        return g;
    }

    function row({ text, value, chevron, onTap, control, danger, icon }) {
        const r = document.createElement('div');
        r.className = 'list-row' + (onTap ? ' tappable' : '') + (danger ? ' danger' : '');

        if (icon) r.append(icon);

        const lab = document.createElement('div');
        lab.className = 'row-label';
        lab.textContent = text;
        r.append(lab);

        if (control) r.append(control);
        if (value !== undefined) {
            const v = document.createElement('div');
            v.className = 'row-value';
            v.textContent = value;
            r.append(v);
        }
        if (chevron) {
            const c = document.createElement('div');
            c.className = 'row-chevron';
            r.append(c);
        }
        if (onTap) r.addEventListener('click', onTap);
        return r;
    }

    function toggle(initial, onChange) {
        const t = document.createElement('div');
        t.className = 'switch' + (initial ? ' on' : '');
        t.addEventListener('click', () => {
            const on = !t.classList.contains('on');
            t.classList.toggle('on', on);
            onChange(on);
        });
        return t;
    }

    function textInput({ placeholder, value, type }) {
        const input = document.createElement('input');
        input.className = 'text-input';
        input.type = type || 'text';
        input.placeholder = placeholder || '';
        input.value = value || '';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        return input;
    }

    function hue(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
        return h;
    }

    function avatar(name, size, photoUrl) {
        const a = document.createElement('div');
        a.className = 'ui-avatar';
        if (size) {
            a.style.width = a.style.height = `${size}px`;
            a.style.fontSize = `${Math.round(size * 0.4)}px`;
        }
        if (photoUrl) {
            a.style.background = `url("${String(photoUrl).replace(/"/g, '%22')}") center/cover`;
            return a;
        }
        const seed = name || '?';
        a.style.background =
            `linear-gradient(135deg, hsl(${hue(seed)},55%,55%), hsl(${(hue(seed) + 40) % 360},55%,40%))`;
        const parts = seed.trim().split(/\s+/);
        a.textContent = (parts.length > 1
            ? parts[0][0] + parts[parts.length - 1][0]
            : seed.slice(0, 2)).toUpperCase();
        return a;
    }

    function confirm(view, text, confirmLabel, opts = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            const sheet = document.createElement('div');
            sheet.className = 'confirm-sheet';

            const msg = document.createElement('div');
            msg.className = 'confirm-text';
            msg.textContent = text;

            const yes = document.createElement('button');
            yes.className = 'confirm-btn ' +
                (opts.danger === false ? 'confirm-primary' : 'confirm-danger');
            yes.textContent = confirmLabel || 'Confirm';
            yes.addEventListener('click', () => { overlay.remove(); resolve(true); });

            const no = document.createElement('button');
            no.className = 'confirm-btn';
            no.textContent = 'Cancel';
            no.addEventListener('click', () => { overlay.remove(); resolve(false); });

            sheet.append(msg, yes, no);
            overlay.append(sheet);
            view.append(overlay);
        });
    }

    function pinPad(opts) {
        const wrap = document.createElement('div');
        wrap.className = 'pin-pad';

        const title = document.createElement('div');
        title.className = 'pin-title';
        title.textContent = opts.title || 'Enter Passcode';

        const dots = document.createElement('div');
        dots.className = 'pin-dots';
        for (let i = 0; i < 4; i++) {
            const d = document.createElement('div');
            d.className = 'pin-dot';
            dots.append(d);
        }

        let entered = '';
        function paint() {
            [...dots.children].forEach((d, i) => d.classList.toggle('filled', i < entered.length));
        }

        const grid = document.createElement('div');
        grid.className = 'pin-grid';
        for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']) {
            const b = document.createElement('button');
            b.className = 'pin-key' + (key === '' ? ' pin-blank' : '');
            b.textContent = key;
            if (key !== '') {
                b.addEventListener('click', () => {
                    PhoneOS.sounds.tick();
                    if (key === '⌫') {
                        entered = entered.slice(0, -1);
                    } else if (entered.length < 4) {
                        entered += key;
                        if (entered.length === 4) {
                            const pin = entered;
                            setTimeout(() => opts.onComplete(pin), 120);
                        }
                    }
                    paint();
                });
            }
            grid.append(b);
        }

        wrap.append(title, dots, grid);
        wrap.reset = (shake) => {
            entered = '';
            paint();
            if (shake) {
                dots.classList.remove('shake');
                void dots.offsetWidth;
                dots.classList.add('shake');
            }
        };
        wrap.setTitle = (t) => { title.textContent = t; };
        return wrap;
    }

    function fmtMoney(n) {
        return '$' + Number(n || 0).toLocaleString('en-US');
    }

    function fmtDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function fmtWhen(ms) {
        if (!ms) return '';
        const d = new Date(ms);
        const now = new Date();
        const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
        if (days <= 0) return PhoneOS.clock.timeString(d);
        if (days === 1) return 'Yesterday';
        return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}`;
    }

    return { header, content, label, group, row, toggle, textInput, avatar,
        confirm, pinPad, fmtWhen, fmtMoney, fmtDuration };
})();

PhoneOS.resolveName = function (number) {
    const contacts = PhoneOS.data && PhoneOS.data.contacts;
    if (!contacts) return number;
    const digits = String(number).replace(/\D/g, '');
    const hit = contacts.find((c) => c.number === number
        || (digits.length > 0 && c.number.replace(/\D/g, '') === digits));
    return hit ? hit.name : number;
};

PhoneOS.ui.authForm = function (opts) {
    const wrap = document.createElement('div');
    wrap.className = 'auth-screen';

    if (opts.iconBg && opts.glyph) {
        const icon = document.createElement('div');
        icon.className = 'ph-icon';
        icon.style.background = opts.iconBg;
        icon.innerHTML = opts.glyph;
        wrap.append(icon);
    }
    const title = document.createElement('div');
    title.className = 'auth-title';
    title.textContent = opts.title;
    const sub = document.createElement('div');
    sub.className = 'auth-sub';
    sub.textContent = opts.sub || '';
    wrap.append(title, sub);

    let mode = 'login';
    const seg = document.createElement('div');
    seg.className = 'seg-control auth-seg';
    const options = [['login', 'Log In'], ['signup', 'Sign Up']];
    const paintSeg = () => {
        seg.textContent = '';
        for (const [value, labelText] of options) {
            const opt = document.createElement('div');
            opt.className = 'seg-option' + (mode === value ? ' selected' : '');
            opt.textContent = labelText;
            opt.addEventListener('click', () => { mode = value; paintSeg(); paintMode(); });
            seg.append(opt);
        }
    };
    wrap.append(seg);

    const form = document.createElement('div');
    form.className = 'form-fields';
    const idRow = document.createElement('div');
    idRow.className = 'auth-id-row';
    const idInput = PhoneOS.ui.textInput({ placeholder: opts.idPlaceholder || 'Username' });
    idRow.append(idInput);
    let suffixEl = null;
    if (opts.idSuffix) {
        suffixEl = document.createElement('span');
        suffixEl.className = 'auth-suffix';
        suffixEl.textContent = opts.idSuffix;
        idRow.append(suffixEl);
    }
    const pwInput = PhoneOS.ui.textInput({ placeholder: 'Password', type: 'password' });
    form.append(idRow, pwInput);

    const extras = [];
    for (const f of opts.extraFields || []) {
        const input = PhoneOS.ui.textInput({ placeholder: f.placeholder });
        input.dataset.key = f.key;
        extras.push(input);
        form.append(input);
    }
    wrap.append(form);

    const error = document.createElement('div');
    error.className = 'form-error';
    wrap.append(error);

    const go = document.createElement('button');
    go.className = 'primary-btn';
    wrap.append(go);

    function paintMode() {
        go.textContent = mode === 'login' ? 'Log In' : 'Create Account';
        for (const e of extras) e.hidden = mode === 'login';
        if (suffixEl) suffixEl.hidden = mode === 'login' && !opts.suffixOnLogin;
    }
    paintSeg();
    paintMode();

    go.addEventListener('click', async () => {
        error.textContent = '';
        const id = idInput.value.trim();
        const pw = pwInput.value;
        if (!id || !pw) { error.textContent = 'Fill in both fields.'; return; }
        const extra = {};
        for (const e of extras) extra[e.dataset.key] = e.value.trim();
        go.disabled = true;
        const err = await opts.onSubmit(mode, id, pw, extra);
        go.disabled = false;
        if (err) error.textContent = err;
    });

    return wrap;
};

PhoneOS.contactAvatar = function (number) {
    const contacts = PhoneOS.data && PhoneOS.data.contacts;
    if (!contacts) return null;
    const hit = contacts.find((c) => c.number === number);
    return hit && hit.avatar ? hit.avatar : null;
};

PhoneOS.data = { contacts: null, threads: null };

PhoneOS.api = (name, data) => PhoneOS.nui('api', { name, data });

PhoneOS.loadContacts = async function (force) {
    if (PhoneOS.data.contacts && !force) return PhoneOS.data.contacts;
    const res = await PhoneOS.api('contacts:list');
    PhoneOS.data.contacts = (res && res.ok && res.data) || [];
    return PhoneOS.data.contacts;
};

// Placeholder rows shown while a list loads, so a screen never flashes empty
// and then jumps. Inert — purely visual.
PhoneOS.ui.skeleton = function (rows, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'skel-wrap';
    if (opts && opts.className) wrap.classList.add(opts.className);
    for (let i = 0; i < (rows || 3); i++) {
        const r = document.createElement('div');
        r.className = 'skel-row';
        if (!(opts && opts.noAvatar)) {
            const av = document.createElement('div');
            av.className = 'skel-av';
            r.append(av);
        }
        const lines = document.createElement('div');
        lines.className = 'skel-lines';
        const l1 = document.createElement('div');
        l1.className = 'skel-line';
        const l2 = document.createElement('div');
        l2.className = 'skel-line short';
        lines.append(l1, l2);
        r.append(lines);
        wrap.append(r);
    }
    return wrap;
};
