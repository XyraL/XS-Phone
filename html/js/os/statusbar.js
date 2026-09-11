PhoneOS.clock = (() => {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    function timeString(d) {
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (PhoneOS.state && PhoneOS.state.settings.time24) {
            return `${String(d.getHours()).padStart(2, '0')}:${mm}`;
        }
        let h = d.getHours() % 12;
        if (h === 0) h = 12;
        return `${h}:${mm}`;
    }

    const sessionStart = Date.now();

    function paintBattery() {
        const fill = document.getElementById('sb-batt-fill');
        if (!fill) return;
        const pct = Math.max(12, 100 - Math.floor((Date.now() - sessionStart) / 120000));
        fill.setAttribute('width', (19 * pct / 100).toFixed(1));
        fill.setAttribute('fill', pct <= 20 ? '#ff453a' : 'currentColor');
    }

    function tick() {
        const d = new Date();
        const t = timeString(d);
        document.getElementById('sb-time').textContent = t;
        document.getElementById('ls-time').textContent = t;
        document.getElementById('ls-date').textContent =
            `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
        paintBattery();
        if (PhoneOS.paintWidgetClock) PhoneOS.paintWidgetClock();
    }

    setInterval(tick, 10000);
    document.addEventListener('DOMContentLoaded', tick);

    return { tick, timeString };
})();
