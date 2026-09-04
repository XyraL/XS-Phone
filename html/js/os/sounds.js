PhoneOS.sounds = (() => {
    let ctx = null;

    function audio() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function note(freq, when, dur, type = 'sine', peak = 0.18) {
        const a = audio();
        const t = a.currentTime + when;
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(a.destination);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    const TEXT_TONES = {
        pop: () => {
            note(880, 0, 0.09);
            note(660, 0.07, 0.12);
        },
        chime: () => {
            note(1318, 0, 0.22);
            note(1046, 0.12, 0.3);
        },
        ding: () => {
            note(1200, 0, 0.4, 'triangle', 0.14);
        },
    };

    const RING_PATTERNS = {
        horizon: () => {
            const seq = [523, 659, 784, 1046];
            seq.forEach((f, i) => note(f, i * 0.13, 0.25, 'sine', 0.15));
            seq.forEach((f, i) => note(f, 0.8 + i * 0.13, 0.25, 'sine', 0.12));
        },
        classic: () => {
            for (const start of [0, 0.55]) {
                for (let i = 0; i < 8; i++) {
                    note(440, start + i * 0.05, 0.05, 'sine', 0.12);
                    note(480, start + i * 0.05, 0.05, 'sine', 0.12);
                }
            }
        },
        pulse: () => {
            [0, 0.18, 0.36, 0.9, 1.08].forEach((t) =>
                note(660, t, 0.1, 'square', 0.07));
        },
    };
    const RING_LOOP_MS = 2100;

    function playText(tone) {
        try {
            (TEXT_TONES[tone] || TEXT_TONES.pop)();
        } catch (e) {  }
    }

    let ringTimer = null;

    function startRing(tone) {
        stopRing();
        const pattern = RING_PATTERNS[tone] || RING_PATTERNS.horizon;
        try {
            pattern();
            ringTimer = setInterval(() => {
                try { pattern(); } catch (e) { stopRing(); }
            }, RING_LOOP_MS);
        } catch (e) {  }
    }

    function stopRing() {
        if (ringTimer) {
            clearInterval(ringTimer);
            ringTimer = null;
        }
    }

    function tick() {
        try { note(1150, 0, 0.03, 'square', 0.035); } catch (e) {  }
    }

    function thump() {
        try {
            note(170, 0, 0.07, 'sine', 0.18);
            note(95, 0.02, 0.1, 'sine', 0.12);
        } catch (e) {  }
    }

    function preview(kind, tone) {
        if (kind === 'ringtone') {
            try { (RING_PATTERNS[tone] || RING_PATTERNS.horizon)(); } catch (e) {  }
        } else {
            playText(tone);
        }
    }

    return { playText, startRing, stopRing, preview, tick, thump };
})();
