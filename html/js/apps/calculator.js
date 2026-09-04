(() => {
    function render(view) {
        view.classList.add('calc-view');
        view.textContent = '';

        let display = '0';
        let stored = null;
        let op = null;
        let fresh = true; // next digit starts a new number

        const screenEl = document.createElement('div');
        screenEl.className = 'calc-display';

        const paint = () => {
            let text = display;
            const num = Number(display);
            if (Number.isFinite(num) && !display.endsWith('.')) {
                text = num.toLocaleString('en-US', { maximumFractionDigits: 8 });
            }
            screenEl.textContent = text.length > 12 ? Number(display).toExponential(5) : text;
        };
        paint();

        const apply = () => {
            if (op === null || stored === null) return;
            const a = stored, b = Number(display);
            let out = 0;
            if (op === '+') out = a + b;
            else if (op === '−') out = a - b;
            else if (op === '×') out = a * b;
            else if (op === '÷') out = b === 0 ? NaN : a / b;
            display = Number.isFinite(out) ? String(+out.toFixed(10)) : 'Error';
            stored = null;
            op = null;
        };

        const press = (key) => {
            if (display === 'Error' && key !== 'C') key = 'C';
            if (/\d/.test(key)) {
                if (fresh || display === '0') { display = key; fresh = false; }
                else if (display.replace(/\D/g, '').length < 12) display += key;
            } else if (key === '.') {
                if (fresh) { display = '0.'; fresh = false; }
                else if (!display.includes('.')) display += '.';
            } else if (key === 'C') {
                display = '0'; stored = null; op = null; fresh = true;
            } else if (key === '±') {
                display = display.startsWith('-') ? display.slice(1) : (display !== '0' ? '-' + display : display);
            } else if (key === '%') {
                display = String(Number(display) / 100);
            } else if (key === '=') {
                apply(); fresh = true;
            } else { // operator
                if (op !== null && !fresh) apply();
                stored = Number(display);
                op = key;
                fresh = true;
            }
            paint();
            grid.querySelectorAll('.calc-op').forEach((b) =>
                b.classList.toggle('active', b.textContent === op && fresh));
        };

        const grid = document.createElement('div');
        grid.className = 'calc-grid';
        const KEYS = [
            ['C', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'],
            ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
            ['4', ''], ['5', ''], ['6', ''], ['−', 'op'],
            ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
            ['0', 'zero'], ['.', ''], ['=', 'op'],
        ];
        for (const [key, kind] of KEYS) {
            const b = document.createElement('button');
            b.className = 'calc-key' +
                (kind === 'op' ? ' calc-op' : kind === 'fn' ? ' calc-fn' : kind === 'zero' ? ' calc-zero' : '');
            b.textContent = key;
            b.addEventListener('click', () => press(key));
            grid.append(b);
        }

        view.append(screenEl, grid);
    }

    PhoneOS.registerApp({
        id: 'calculator', name: 'Calculator',
        iconBg: 'linear-gradient(135deg,#3d3d42,#141417)',
        glyph: PhoneOS.glyphs.calculator,
        render,
    });
})();
