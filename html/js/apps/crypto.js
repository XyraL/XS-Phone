(() => {
    const ui = PhoneOS.ui;
    let timer = null;
    let market = null;
    let range = '24H';

    const ERRORS = {
        insufficient: 'Not enough money in your account.',
        not_enough_coin: 'You don’t hold that much.',
        bad_amount: 'Enter a valid amount.',
        invalid_number: 'That number isn’t in service.',
        rate_limited: 'Slow down a little.',
    };

    function fmtPrice(p) {
        const d = p >= 100 ? 2 : (p >= 1 ? 3 : 5);
        return '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    }

    function fmtUsd(v) {
        return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtCoin(a) {
        const n = Number(a) || 0;
        const d = n >= 100 ? 2 : (n >= 1 ? 4 : 6);
        return n.toLocaleString('en-US', { maximumFractionDigits: d });
    }

    function pct(v) {
        const el = document.createElement('div');
        el.className = 'cr-pct ' + (v >= 0 ? 'up' : 'down');
        el.textContent = (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(2) + '%';
        return el;
    }

    function badge(coin, size) {
        const b = document.createElement('div');
        b.className = 'cr-badge';
        b.style.background = coin.color;
        if (size) {
            b.style.width = b.style.height = size + 'px';
            b.style.fontSize = Math.round(size * 0.36) + 'px';
        }
        b.textContent = coin.symbol.slice(0, 3);
        return b;
    }

    function svgEl(tag, attrs) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    }

    function points(values, w, h, pad) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = max - min || 1;
        return values.map((v, i) => [
            (i / Math.max(1, values.length - 1)) * w,
            pad + (1 - (v - min) / span) * (h - pad * 2),
        ]);
    }

    function spark(values, up) {
        const svg = svgEl('svg', { viewBox: '0 0 64 26', class: 'cr-spark' });
        if (!values || values.length < 2) return svg;
        const pts = points(values, 64, 26, 3);
        svg.append(svgEl('polyline', {
            points: pts.map((p) => p.join(',')).join(' '),
            fill: 'none', stroke: up ? '#30d158' : '#ff453a', 'stroke-width': '1.6',
            'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        }));
        return svg;
    }

    function chart(values, up, onScrub) {
        const W = 300;
        const H = 150;
        const wrap = document.createElement('div');
        wrap.className = 'cr-chart';
        const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });
        if (!values || values.length < 2) { wrap.append(svg); return wrap; }
        const colour = up ? '#30d158' : '#ff453a';
        const pts = points(values, W, H, 10);
        const id = 'crg' + Math.random().toString(36).slice(2, 8);
        const defs = svgEl('defs', {});
        const grad = svgEl('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' });
        grad.append(svgEl('stop', { offset: '0%', 'stop-color': colour, 'stop-opacity': '0.32' }));
        grad.append(svgEl('stop', { offset: '100%', 'stop-color': colour, 'stop-opacity': '0' }));
        defs.append(grad);
        const line = pts.map((p) => p.join(',')).join(' ');
        svg.append(defs,
            svgEl('polygon', { points: `0,${H} ${line} ${W},${H}`, fill: `url(#${id})` }),
            svgEl('polyline', { points: line, fill: 'none', stroke: colour, 'stroke-width': '2', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
        const cursor = svgEl('line', { x1: 0, x2: 0, y1: 0, y2: H, stroke: 'currentColor', 'stroke-opacity': '0.35', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke', visibility: 'hidden' });
        svg.append(cursor);
        wrap.append(svg);

        const dot = document.createElement('div');
        dot.className = 'cr-dot';
        dot.style.background = colour;
        wrap.append(dot);
        const place = (i) => {
            const [x, y] = pts[i];
            dot.style.left = (x / W * 100) + '%';
            dot.style.top = (y / H * 100) + '%';
        };
        place(pts.length - 1);

        wrap.addEventListener('pointermove', (e) => {
            const r = wrap.getBoundingClientRect();
            const i = Math.max(0, Math.min(values.length - 1, Math.round((e.clientX - r.left) / r.width * (values.length - 1))));
            cursor.setAttribute('x1', pts[i][0]);
            cursor.setAttribute('x2', pts[i][0]);
            cursor.setAttribute('visibility', 'visible');
            place(i);
            onScrub(values[i], i);
        });
        wrap.addEventListener('pointerleave', () => {
            cursor.setAttribute('visibility', 'hidden');
            place(pts.length - 1);
            onScrub(null);
        });
        return wrap;
    }

    function stopTimer() {
        clearInterval(timer);
        timer = null;
    }

    async function loadMarket() {
        const res = await PhoneOS.api('crypto:market');
        if (res && res.ok) market = res.data;
        return market;
    }

    function portfolioValue(m) {
        let now = 0;
        let before = 0;
        for (const c of m.coins) {
            const held = m.holdings[c.id] || 0;
            now += held * c.price;
            before += held * (c.price / (1 + c.change / 100));
        }
        return { now, change: before > 0 ? (now - before) / before * 100 : 0 };
    }

    function coinRow(view, coin, held) {
        const row = document.createElement('div');
        row.className = 'cr-row';
        row.append(badge(coin, 38));
        const info = document.createElement('div');
        info.className = 'cr-row-info';
        const name = document.createElement('div');
        name.className = 'cr-row-name';
        name.textContent = coin.name;
        const sub = document.createElement('div');
        sub.className = 'cr-row-sub';
        sub.textContent = held ? fmtCoin(held) + ' ' + coin.symbol : coin.symbol;
        info.append(name, sub);
        const right = document.createElement('div');
        right.className = 'cr-row-right';
        const price = document.createElement('div');
        price.className = 'cr-row-price';
        price.textContent = held ? fmtUsd(held * coin.price) : fmtPrice(coin.price);
        right.append(price, pct(coin.change));
        row.append(info, spark(coin.spark, coin.change >= 0), right);
        row.addEventListener('click', () => detail(view, coin.id));
        return row;
    }

    async function home(view) {
        stopTimer();
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('Crypto'));
        const skel = ui.skeleton(5);
        view.append(skel);
        const m = await loadMarket();
        if (!fresh()) return;
        skel.remove();
        if (!m) return;

        const content = ui.content();
        const pv = portfolioValue(m);
        const card = document.createElement('div');
        card.className = 'cr-card';
        const lab = document.createElement('div');
        lab.className = 'cr-card-label';
        lab.textContent = 'Portfolio';
        const value = document.createElement('div');
        value.className = 'cr-card-value';
        value.textContent = fmtUsd(pv.now);
        const foot = document.createElement('div');
        foot.className = 'cr-card-foot';
        const cash = document.createElement('div');
        cash.textContent = 'Cash ' + ui.fmtMoney(m.cash);
        foot.append(cash);
        if (pv.now > 0) foot.append(pct(pv.change));
        card.append(lab, value, foot);
        content.append(card);

        const owned = m.coins.filter((c) => (m.holdings[c.id] || 0) > 0);
        if (owned.length) {
            content.append(ui.label('Your coins'));
            const box = document.createElement('div');
            box.className = 'cr-list';
            for (const c of owned) box.append(coinRow(view, c, m.holdings[c.id]));
            content.append(box);
        }
        content.append(ui.label('Market'));
        const list = document.createElement('div');
        list.className = 'cr-list';
        for (const c of m.coins) list.append(coinRow(view, c, 0));
        content.append(list);
        const note = document.createElement('div');
        note.className = 'cr-note';
        note.textContent = 'Prices move every ' + Math.round((m.tick || 60) / 60 * 10) / 10 + ' min. '
            + (m.fee ? 'Trades cost ' + (m.fee * 100).toFixed(1).replace(/\.0$/, '') + '%.' : '');
        content.append(note);
        view.append(content);

        timer = setInterval(async () => {
            if (!document.body.contains(view)) { stopTimer(); return; }
            const before = JSON.stringify(market && market.coins.map((c) => c.price));
            await loadMarket();
            if (fresh() && JSON.stringify(market.coins.map((c) => c.price)) !== before) home(view);
        }, 15000);
    }

    async function detail(view, coinId) {
        stopTimer();
        const fresh = PhoneOS.freshRender(view);
        const res = await PhoneOS.api('crypto:coin', { coin: coinId, range });
        if (!fresh()) return;
        if (!res || !res.ok) { home(view); return; }
        const c = res.data;
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Crypto', onTap: () => home(view) } }));
        const content = ui.content();

        const top = document.createElement('div');
        top.className = 'cr-top';
        top.append(badge(c, 30));
        const name = document.createElement('div');
        name.className = 'cr-top-name';
        name.textContent = c.name + ' · ' + c.symbol;
        top.append(name);

        const price = document.createElement('div');
        price.className = 'cr-price';
        price.textContent = fmtPrice(c.price);
        const changeRow = document.createElement('div');
        changeRow.className = 'cr-change-row';
        const changeLabel = document.createElement('span');
        changeLabel.className = 'cr-range-label';
        changeLabel.textContent = { '1H': 'Past hour', '6H': 'Past 6 hours', '24H': 'Past day' }[range];
        changeRow.append(pct(c.rangeChange), changeLabel);

        const graph = chart(c.chart, c.rangeChange >= 0, (v) => {
            price.textContent = fmtPrice(v === null ? c.price : v);
        });

        const tabs = document.createElement('div');
        tabs.className = 'seg-control cr-tabs';
        for (const r of ['1H', '6H', '24H']) {
            const t = document.createElement('div');
            t.className = 'seg-option' + (range === r ? ' selected' : '');
            t.textContent = r;
            t.addEventListener('click', () => { range = r; detail(view, coinId); });
            tabs.append(t);
        }

        const hold = document.createElement('div');
        hold.className = 'cr-hold';
        const holdLabel = document.createElement('div');
        holdLabel.className = 'cr-hold-label';
        holdLabel.textContent = 'You own';
        const holdValue = document.createElement('div');
        holdValue.className = 'cr-hold-value';
        holdValue.textContent = fmtCoin(c.holding) + ' ' + c.symbol;
        const holdUsd = document.createElement('div');
        holdUsd.className = 'cr-hold-usd';
        holdUsd.textContent = fmtUsd(c.holding * c.price);
        hold.append(holdLabel, holdValue, holdUsd);

        const actions = document.createElement('div');
        actions.className = 'cr-actions';
        const btn = (cls, text, fn) => {
            const b = document.createElement('button');
            b.className = 'cr-btn ' + cls;
            b.textContent = text;
            b.addEventListener('click', fn);
            actions.append(b);
            return b;
        };
        btn('buy', 'Buy', () => tradeSheet(view, c, 'buy'));
        const sell = btn('sell', 'Sell', () => tradeSheet(view, c, 'sell'));
        const send = btn('send', 'Send', () => sendSheet(view, c));
        if (!(c.holding > 0)) { sell.disabled = true; send.disabled = true; }

        content.append(top, price, changeRow, graph, tabs, hold, actions);

        if (c.activity && c.activity.length) {
            content.append(ui.label('Activity'));
            content.append(ui.group(c.activity.map((a) => {
                const side = { buy: 'Bought', sell: 'Sold', send: 'Sent', receive: 'Received' }[a.side] || a.side;
                const who = a.other ? (a.side === 'send' ? ' to ' : ' from ') + PhoneOS.resolveName(a.other) : '';
                const amount = document.createElement('div');
                amount.className = 'cr-act-amount ' + (a.side === 'buy' || a.side === 'receive' ? 'in' : 'out');
                amount.textContent = (a.side === 'buy' || a.side === 'receive' ? '+' : '−') + fmtCoin(a.amount) + ' ' + c.symbol;
                const r = ui.row({ text: side + who, value: ui.fmtWhen(a.at), control: amount });
                if (a.usd) {
                    const note = document.createElement('div');
                    note.className = 'tx-note';
                    note.textContent = ui.fmtMoney(a.usd) + ' at ' + fmtPrice(a.price);
                    r.querySelector('.row-label').append(note);
                }
                return r;
            })));
        }
        view.append(content);

        timer = setInterval(async () => {
            if (!document.body.contains(view)) { stopTimer(); return; }
            const again = await PhoneOS.api('crypto:coin', { coin: coinId, range });
            if (fresh() && again && again.ok && again.data.price !== c.price) detail(view, coinId);
        }, 15000);
    }

    function sheetShell(view, titleText) {
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet cr-sheet';
        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = titleText;
        sheet.append(title);
        overlay.append(sheet);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        view.append(overlay);
        return { overlay, sheet };
    }

    function tradeSheet(view, c, side) {
        const fee = (market && market.fee) || 0;
        const cash = (market && market.cash) || 0;
        const { overlay, sheet } = sheetShell(view, (side === 'buy' ? 'Buy ' : 'Sell ') + c.name);
        let sellAll = false;

        const amount = document.createElement('input');
        amount.className = 'cr-amount';
        amount.type = 'number';
        amount.placeholder = '$0';
        amount.min = '1';
        const avail = document.createElement('div');
        avail.className = 'cr-avail';
        avail.textContent = side === 'buy' ? 'Cash ' + ui.fmtMoney(cash) : 'You own ' + fmtCoin(c.holding) + ' ' + c.symbol + ' · ' + fmtUsd(c.holding * c.price);

        const chips = document.createElement('div');
        chips.className = 'wallet-chips';
        const maxUsd = side === 'buy' ? cash : Math.floor(c.holding * c.price);
        for (const [label, v] of [['$100', 100], ['$500', 500], ['$1,000', 1000], ['Max', 'max']]) {
            const chip = document.createElement('button');
            chip.className = 'wallet-chip';
            chip.textContent = label;
            chip.addEventListener('click', () => {
                sellAll = v === 'max' && side === 'sell';
                amount.value = v === 'max' ? maxUsd : v;
                preview();
            });
            chips.append(chip);
        }

        const est = document.createElement('div');
        est.className = 'cr-est';
        const error = document.createElement('div');
        error.className = 'form-error';
        const go = document.createElement('button');
        go.className = 'confirm-btn ' + (side === 'buy' ? 'cr-go-buy' : 'cr-go-sell');
        go.textContent = side === 'buy' ? 'Buy' : 'Sell';

        function preview() {
            const usd = Number(amount.value) || 0;
            if (usd <= 0) { est.textContent = ''; return; }
            if (side === 'buy') {
                est.textContent = '≈ ' + fmtCoin(usd * (1 - fee) / c.price) + ' ' + c.symbol
                    + (fee ? ' · fee ' + fmtUsd(usd * fee) : '');
            } else {
                const coins = sellAll ? c.holding : usd / c.price;
                est.textContent = fmtCoin(coins) + ' ' + c.symbol + ' → ' + fmtUsd(coins * c.price * (1 - fee))
                    + (fee ? ' after fee' : '');
            }
        }
        amount.addEventListener('input', () => { sellAll = false; preview(); });

        go.addEventListener('click', async () => {
            error.textContent = '';
            const usd = Number(amount.value) || 0;
            if (usd <= 0 && !sellAll) { error.textContent = ERRORS.bad_amount; return; }
            go.disabled = true;
            const res = await PhoneOS.api('crypto:trade', { coin: c.id, side, usd, all: sellAll });
            go.disabled = false;
            if (!res || !res.ok) { error.textContent = ERRORS[res && res.error] || 'Trade failed.'; return; }
            overlay.remove();
            PhoneOS.notify({
                app: 'crypto', title: side === 'buy' ? 'Bought ' + c.symbol : 'Sold ' + c.symbol,
                body: fmtCoin(res.data.amount) + ' ' + c.symbol + ' for ' + ui.fmtMoney(res.data.usd),
            });
            await loadMarket();
            detail(view, c.id);
        });

        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());
        sheet.append(amount, avail, chips, est, error, go, cancel);
        amount.focus();
    }

    async function sendSheet(view, c) {
        const contacts = (await PhoneOS.loadContacts()).filter((x) => !x.blocked);
        const { overlay, sheet } = sheetShell(view, 'Send ' + c.name);
        const to = ui.textInput({ placeholder: 'Number (e.g. 555-0142)' });
        to.inputMode = 'tel';
        const amount = ui.textInput({ placeholder: 'Amount in ' + c.symbol, type: 'number' });
        const max = document.createElement('button');
        max.className = 'wallet-chip cr-max';
        max.textContent = 'Max ' + fmtCoin(c.holding);
        max.addEventListener('click', () => { amount.value = c.holding; });
        const error = document.createElement('div');
        error.className = 'form-error';
        const go = document.createElement('button');
        go.className = 'confirm-btn confirm-primary';
        go.textContent = 'Send';
        go.addEventListener('click', async () => {
            error.textContent = '';
            go.disabled = true;
            const res = await PhoneOS.api('crypto:send', { coin: c.id, to: to.value.trim(), amount: Number(amount.value) });
            go.disabled = false;
            if (!res || !res.ok) { error.textContent = ERRORS[res && res.error] || 'Couldn’t send it.'; return; }
            overlay.remove();
            PhoneOS.notify({ app: 'crypto', title: 'Crypto sent', body: fmtCoin(res.data.amount) + ' ' + c.symbol + ' to ' + PhoneOS.resolveName(shownNumber(to.value)) });
            detail(view, c.id);
        });
        sheet.append(to, amount, max, error, go);
        if (contacts.length) {
            sheet.append(ui.group(contacts.slice(0, 12).map((x) => {
                const r = ui.row({ text: x.name, value: x.number, onTap: () => { to.value = x.number; } });
                r.prepend(ui.avatar(x.name, 30, x.avatar || null));
                return r;
            })));
        }
        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());
        sheet.append(cancel);
    }

    function shownNumber(raw) {
        const digits = String(raw || '').replace(/\D/g, '');
        return digits.length === 7 ? digits.slice(0, 3) + '-' + digits.slice(3) : String(raw || '');
    }

    PhoneOS.registerApp({
        id: 'crypto', name: 'Crypto', store: true,
        iconBg: 'linear-gradient(135deg,#ffb340,#ef7a0c)',
        glyph: PhoneOS.glyphs.crypto,
        render: (view) => home(view),
        onClose: stopTimer,
    });
})();
