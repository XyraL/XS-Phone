(() => {
    const ui = PhoneOS.ui;

    const WEATHER = {
        EXTRASUNNY: { icon: '☀️', label: 'Sunny', temp: [28, 34] },
        CLEAR:      { icon: '🌤', label: 'Clear', temp: [22, 28] },
        NEUTRAL:    { icon: '🌤', label: 'Fair', temp: [20, 25] },
        CLOUDS:     { icon: '⛅', label: 'Cloudy', temp: [17, 22] },
        OVERCAST:   { icon: '☁️', label: 'Overcast', temp: [14, 19] },
        SMOG:       { icon: '🌫', label: 'Smoggy', temp: [18, 24] },
        FOGGY:      { icon: '🌫', label: 'Foggy', temp: [12, 16] },
        CLEARING:   { icon: '🌦', label: 'Clearing', temp: [15, 20] },
        RAIN:       { icon: '🌧', label: 'Rain', temp: [12, 16] },
        DRIZZLE:    { icon: '🌦', label: 'Drizzle', temp: [13, 17] },
        THUNDER:    { icon: '⛈', label: 'Thunderstorm', temp: [11, 15] },
        SNOWLIGHT:  { icon: '🌨', label: 'Light snow', temp: [-2, 2] },
        SNOW:       { icon: '❄️', label: 'Snow', temp: [-6, 0] },
        BLIZZARD:   { icon: '❄️', label: 'Blizzard', temp: [-12, -5] },
        XMAS:       { icon: '🌨', label: 'Snowy', temp: [-4, 1] },
        HALLOWEEN:  { icon: '🌫', label: 'Eerie', temp: [8, 13] },
    };

    function tempFor(info, hour) {
        const [lo, hi] = info.temp;
        const dayCurve = Math.sin(((hour - 5) / 24) * Math.PI * 2) * 0.5 + 0.5;
        return Math.round(lo + (hi - lo) * dayCurve);
    }

    async function render(view) {
        view.textContent = '';
        view.append(ui.header('Weather'));

        const content = ui.content();
        const res = await PhoneOS.nui('getWeather');
        const weather = (res && res.ok && res.weather) || 'CLEAR';
        const info = WEATHER[weather] || WEATHER.CLEAR;
        const hour = (res && res.hour) ?? 12;
        const minute = (res && res.minute) ?? 0;

        const hero = document.createElement('div');
        hero.className = 'weather-hero';

        const icon = document.createElement('div');
        icon.className = 'wx-icon';
        icon.textContent = info.icon;

        const temp = document.createElement('div');
        temp.className = 'wx-temp';
        temp.textContent = `${tempFor(info, hour)}°`;

        const label = document.createElement('div');
        label.className = 'wx-label';
        label.textContent = info.label;

        const place = document.createElement('div');
        place.className = 'wx-place';
        place.textContent = 'Los Santos';

        hero.append(place, icon, temp, label);
        content.append(hero);

        content.append(ui.label('In-game time'));
        content.append(ui.group([
            ui.row({
                text: 'Local time',
                value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            }),
            ui.row({
                text: 'Conditions',
                value: info.label,
            }),
        ]));

        const refresh = document.createElement('button');
        refresh.className = 'primary-btn';
        refresh.textContent = 'Refresh';
        refresh.addEventListener('click', () => render(view));
        content.append(refresh);

        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'weather', name: 'Weather', store: true,
        iconBg: 'linear-gradient(135deg,#54b9f5,#2668d8)',
        glyph: PhoneOS.glyphs.weather,
        render,
    });
})();
