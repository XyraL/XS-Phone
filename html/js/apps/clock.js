(() => {
    const ui = PhoneOS.ui;
    let swInterval = null;
    let swStart = null;
    let swAccum = 0;

    async function render(view) {
        view.textContent = '';
        view.append(ui.header('Clock', {
            action: { label: '+', onTap: () => addAlarm(view) },
        }));

        const content = ui.content();

        const wrap = document.createElement('div');
        wrap.className = 'clock-hero';
        let marks = '';
        for (let i = 0; i < 12; i++) {
            const a = (i * 30) * Math.PI / 180;
            const x1 = 50 + Math.sin(a) * 42, y1 = 50 - Math.cos(a) * 42;
            const x2 = 50 + Math.sin(a) * (i % 3 === 0 ? 34 : 38), y2 = 50 - Math.cos(a) * (i % 3 === 0 ? 34 : 38);
            marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${i % 3 === 0 ? 'cf-mark-big' : 'cf-mark'}"/>`;
        }
        wrap.innerHTML = `<svg class="clock-face" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="47" class="cf-ring"/>${marks}
            <line id="cf-hour" x1="50" y1="50" x2="50" y2="28" class="cf-hour"/>
            <line id="cf-min" x1="50" y1="50" x2="50" y2="16" class="cf-min"/>
            <line id="cf-sec" x1="50" y1="56" x2="50" y2="12" class="cf-sec"/>
            <circle cx="50" cy="50" r="2.4" class="cf-pin"/>
        </svg>`;
        const digital = document.createElement('div');
        digital.className = 'clock-digital';
        wrap.append(digital);
        content.append(wrap);

        function paintClock() {
            const d = new Date();
            const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
            const rot = (el, deg) => {
                const hand = wrap.querySelector(el);
                if (hand) hand.setAttribute('transform', `rotate(${deg} 50 50)`);
            };
            rot('#cf-hour', (h % 12) * 30 + m * 0.5);
            rot('#cf-min', m * 6 + s * 0.1);
            rot('#cf-sec', s * 6);
            digital.textContent = PhoneOS.clock.timeString(d);
        }
        paintClock();
        const clockTimer = setInterval(paintClock, 1000);
        const watchdog = new MutationObserver(() => {
            if (!document.body.contains(wrap)) {
                clearInterval(clockTimer);
                watchdog.disconnect();
            }
        });
        watchdog.observe(document.getElementById('app-layer'), { childList: true, subtree: true });

        content.append(ui.label('Alarms'));
        const res = await PhoneOS.api('alarms:list');
        const alarms = (res && res.ok && res.data) || [];
        if (!alarms.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No alarms. Tap + to add one.';
            content.append(empty);
        } else {
            content.append(ui.group(alarms.map((a) => {
                const r = ui.row({
                    text: a.time,
                    value: a.label || '',
                    control: ui.toggle(!!a.enabled, () =>
                        PhoneOS.api('alarms:toggle', { id: a.id })),
                });
                r.classList.add('alarm-row');
                r.addEventListener('dblclick', async () => {
                    if (await ui.confirm(view, `Delete the ${a.time} alarm?`, 'Delete')) {
                        await PhoneOS.api('alarms:delete', { id: a.id });
                        render(view);
                    }
                });
                return r;
            })));
            const hint = document.createElement('div');
            hint.className = 'about-footer';
            hint.textContent = 'Double-tap an alarm to delete it';
            content.append(hint);
        }

        content.append(ui.label('Stopwatch'));
        const sw = document.createElement('div');
        sw.className = 'stopwatch';
        const swDisplay = document.createElement('div');
        swDisplay.className = 'sw-display';

        const paint = () => {
            const total = swAccum + (swStart ? Date.now() - swStart : 0);
            const cs = Math.floor((total % 1000) / 10);
            const s = Math.floor(total / 1000) % 60;
            const m = Math.floor(total / 60000);
            swDisplay.textContent =
                `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
        };
        paint();

        const controls = document.createElement('div');
        controls.className = 'sw-controls';
        const startStop = document.createElement('button');
        startStop.className = 'contact-action';
        startStop.textContent = swStart ? 'Stop' : 'Start';
        startStop.addEventListener('click', () => {
            if (swStart) {
                swAccum += Date.now() - swStart;
                swStart = null;
                clearInterval(swInterval);
                startStop.textContent = 'Start';
            } else {
                swStart = Date.now();
                swInterval = setInterval(paint, 50);
                startStop.textContent = 'Stop';
            }
        });
        const reset = document.createElement('button');
        reset.className = 'contact-action';
        reset.textContent = 'Reset';
        reset.addEventListener('click', () => {
            swAccum = 0;
            if (swStart) swStart = Date.now();
            paint();
        });
        controls.append(startStop, reset);
        sw.append(swDisplay, controls);
        content.append(sw);

        if (swStart) swInterval = setInterval(paint, 50);
        view.append(content);
    }

    function addAlarm(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Clock', onTap: () => render(view) } }));

        const content = ui.content();
        content.append(ui.label('New alarm'));

        const timeInput = ui.textInput({ placeholder: 'HH:MM (24h)', type: 'time' });
        const labelInput = ui.textInput({ placeholder: 'Label (optional)' });
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(timeInput, labelInput);
        content.append(form);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const save = document.createElement('button');
        save.className = 'primary-btn';
        save.textContent = 'Add Alarm';
        save.addEventListener('click', async () => {
            const res = await PhoneOS.api('alarms:save', {
                time: timeInput.value,
                label: labelInput.value.trim(),
            });
            if (res && res.ok) render(view);
            else error.textContent = res && res.error === 'full'
                ? 'Alarm limit reached (10).' : 'Enter a valid time.';
        });
        content.append(save);
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'clock', name: 'Clock',
        iconBg: 'linear-gradient(135deg,#2b2b31,#101013)',
        glyph: PhoneOS.glyphs.clock,
        render,
    });
})();
