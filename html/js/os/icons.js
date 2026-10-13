PhoneOS.icons = (() => {
    const lin = (id, stops, x2 = 0, y2 = 1) =>
        `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">`
        + stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')
        + '</linearGradient>';
    const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
        `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">`
        + stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')
        + '</radialGradient>';
    const drop = (id, dy = 1.4, sd = 1.4, op = 0.28) =>
        `<filter id="${id}" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${sd}" flood-color="#000" flood-opacity="${op}"/></filter>`;
    const svg = (defs, body) =>
        `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`;
    const bg = (id) => `<rect width="64" height="64" fill="url(#${id})"/>`;
    const white = (id) => lin(id, [[0, '#ffffff'], [1, '#e9ecf2']]);

    function spokes(n, fn) {
        let out = '';
        for (let i = 0; i < n; i++) out += fn(i, (360 / n) * i);
        return out;
    }

    const ART = {
        phone: svg(lin('ph-bg', [[0, '#72f383'], [1, '#1dbb3d']]) + white('ph-w') + drop('ph-s'),
            bg('ph-bg') + '<g filter="url(#ph-s)" transform="translate(13.5 13.5) scale(1.55)"><path fill="url(#ph-w)" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></g>'),

        messages: svg(lin('ms-bg', [[0, '#74f377'], [1, '#1bb53a']]) + white('ms-w') + drop('ms-s'),
            bg('ms-bg') + '<path filter="url(#ms-s)" fill="url(#ms-w)" d="M32 13c-11.9 0-21.5 8-21.5 17.9 0 5.5 3 10.5 7.8 13.8-.5 2.6-1.9 5.1-3.7 6.9 3.8-.2 7.5-1.6 10.2-3.8 2.3.6 4.7 1 7.2 1 11.9 0 21.5-8 21.5-17.9S43.9 13 32 13z"/>'),

        contacts: svg(lin('ct-bg', [[0, '#eeeef2'], [1, '#c7c7cf']]) + lin('ct-p', [[0, '#a3a3ad'], [1, '#6b6b76']]) + drop('ct-s', 1, 1, 0.18),
            bg('ct-bg') + '<g filter="url(#ct-s)" fill="url(#ct-p)"><circle cx="32" cy="24.5" r="10"/><path d="M12.5 54c0-11 8.7-17.5 19.5-17.5S51.5 43 51.5 54v2h-39z"/></g>'),

        settings: svg(lin('st-bg', [[0, '#b4b4bb'], [1, '#6d6d75']]) + lin('st-g', [[0, '#55555d'], [1, '#2c2c31']]) + lin('st-r', [[0, '#d9d9de'], [1, '#9b9ba3']]) + drop('st-s', 1.2, 1.4, 0.35),
            bg('st-bg') + '<g filter="url(#st-s)"><g fill="url(#st-g)">'
            + spokes(12, (i, a) => `<rect x="29" y="7.5" width="6" height="10" rx="1.6" transform="rotate(${a} 32 32)"/>`)
            + '<circle cx="32" cy="32" r="19"/></g><circle cx="32" cy="32" r="13.5" fill="url(#st-r)"/><g fill="url(#st-g)">'
            + spokes(8, (i, a) => `<rect x="30.4" y="19.5" width="3.2" height="8" rx="1" transform="rotate(${a} 32 32)"/>`)
            + '<circle cx="32" cy="32" r="7.5"/></g><circle cx="32" cy="32" r="3.2" fill="url(#st-r)"/></g>'),

        camera: svg(lin('cm-bg', [[0, '#eeeef2'], [1, '#b9b9c1']]) + lin('cm-b', [[0, '#3a3a40'], [1, '#111114']]) + rad('cm-l', [[0, '#5c8ad6'], [0.45, '#1b2c55'], [1, '#05070d']], 0.4, 0.38, 0.6) + drop('cm-s', 1.6, 1.6, 0.35),
            bg('cm-bg') + '<g filter="url(#cm-s)"><path fill="url(#cm-b)" d="M24.5 19l2.6-4.2c.5-.8 1.3-1.3 2.2-1.3h5.4c.9 0 1.7.5 2.2 1.3l2.6 4.2H50a5 5 0 0 1 5 5v21a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5V24a5 5 0 0 1 5-5z"/>'
            + '<circle cx="32" cy="34" r="11.5" fill="#56565e"/><circle cx="32" cy="34" r="9.5" fill="url(#cm-l)"/><ellipse cx="28.8" cy="30.6" rx="3" ry="2" fill="#fff" opacity="0.55"/><rect x="45" y="23" width="5" height="3" rx="1.2" fill="#ffd60a"/></g>'),

        gallery: svg(lin('gl-bg', [[0, '#ffffff'], [1, '#eef0f4']]),
            bg('gl-bg') + '<g style="mix-blend-mode:multiply" opacity="0.9">'
            + ['#f9a51a', '#f7d81e', '#9cd147', '#3fc1c9', '#3d8bf2', '#8e5cd6', '#e94c89', '#f2583e']
                .map((c, i) => `<ellipse cx="32" cy="19.5" rx="6.6" ry="11.2" fill="${c}" transform="rotate(${i * 45} 32 32)"/>`).join('')
            + '</g>'),

        wallet: svg(lin('wl-bg', [[0, '#26262a'], [1, '#050506']]) + lin('wl-p', [[0, '#3a3a3f'], [1, '#1d1d21']]) + drop('wl-s', -1, 1.2, 0.4),
            bg('wl-bg') + '<rect x="11" y="13" width="42" height="18" rx="4" fill="#2f8bff"/><rect x="11" y="18.5" width="42" height="18" rx="4" fill="#ffc400"/><rect x="11" y="24" width="42" height="18" rx="4" fill="#34c759"/><rect x="11" y="29.5" width="42" height="18" rx="4" fill="#ff6b3d"/>'
            + '<path filter="url(#wl-s)" fill="url(#wl-p)" d="M9 36h15.5c1.2 0 2.2.7 2.8 1.7l.7 1.3c.8 1.4 2.3 2.3 4 2.3s3.2-.9 4-2.3l.7-1.3c.6-1 1.6-1.7 2.8-1.7H55v12.5a4.5 4.5 0 0 1-4.5 4.5h-37A4.5 4.5 0 0 1 9 48.5z"/>'),

        notes: svg(lin('nt-bg', [[0, '#ffffff'], [1, '#f1f1f1']]) + lin('nt-t', [[0, '#ffdc5c'], [1, '#ffc316']]),
            bg('nt-bg') + '<rect width="64" height="20" fill="url(#nt-t)"/><rect y="19.5" width="64" height="1" fill="#e2a800" opacity="0.5"/>'
            + [29, 37, 45, 53].map((y) => `<rect x="8" y="${y}" width="48" height="1.3" rx="0.6" fill="#d8d8dc"/>`).join('')
            + [10, 16, 22, 28, 34, 40, 46, 52].map((x) => `<circle cx="${x}" cy="10" r="1.1" fill="#fff" opacity="0.7"/>`).join('')),

        clock: svg(lin('ck-bg', [[0, '#1a1a1d'], [1, '#000']]) + lin('ck-f', [[0, '#ffffff'], [1, '#e6e6ea']]),
            bg('ck-bg') + '<circle cx="32" cy="32" r="24" fill="url(#ck-f)"/>'
            + spokes(12, (i, a) => `<rect x="31.3" y="10" width="1.4" height="${i % 3 === 0 ? 4.4 : 3}" rx="0.6" fill="#1c1c1e" transform="rotate(${a} 32 32)"/>`)
            + '<rect x="30.6" y="17.5" width="2.8" height="16" rx="1.4" fill="#1c1c1e" transform="rotate(-40 32 32)"/><rect x="30.9" y="13.5" width="2.2" height="20" rx="1.1" fill="#1c1c1e" transform="rotate(75 32 32)"/>'
            + '<rect x="31.5" y="11" width="1" height="25" rx="0.5" fill="#ff9500" transform="rotate(150 32 32)"/><circle cx="32" cy="32" r="2.2" fill="#ff9500"/><circle cx="32" cy="32" r="0.9" fill="#fff"/>'),

        calculator: svg(lin('cl-bg', [[0, '#333337'], [1, '#0d0d0f']]) + lin('cl-o', [[0, '#ffb340'], [1, '#ff8a00']]) + lin('cl-g', [[0, '#b8b8be'], [1, '#8e8e95']]),
            bg('cl-bg') + '<circle cx="21" cy="21" r="9" fill="url(#cl-g)"/><circle cx="43" cy="21" r="9" fill="url(#cl-o)"/><circle cx="21" cy="43" r="9" fill="#4a4a50"/><circle cx="43" cy="43" r="9" fill="url(#cl-o)"/>'
            + '<rect x="16.5" y="19.9" width="9" height="2.3" rx="1.1" fill="#1c1c1e"/><g transform="rotate(45 43 21)" fill="#fff"><rect x="38.5" y="19.9" width="9" height="2.3" rx="1.1"/><rect x="41.9" y="16.5" width="2.3" height="9" rx="1.1"/></g>'
            + '<g fill="#fff"><rect x="16.5" y="41.9" width="9" height="2.3" rx="1.1"/><rect x="19.9" y="38.5" width="2.3" height="9" rx="1.1"/><rect x="38.5" y="39.6" width="9" height="2.1" rx="1"/><rect x="38.5" y="44.3" width="9" height="2.1" rx="1"/></g>'),

        social: svg(lin('so-bg', [[0, '#5fd0ff'], [1, '#1588e8']]) + white('so-w') + drop('so-s'),
            bg('so-bg') + '<g filter="url(#so-s)" transform="translate(12.5 13) scale(1.62)"><path fill="url(#so-w)" d="M21.5 6.1c-.6.3-1.3.5-2 .6a3.5 3.5 0 0 0 1.6-1.9c-.7.4-1.5.7-2.3.9a3.6 3.6 0 0 0-6.2 3.3A10.2 10.2 0 0 1 5.2 5a3.6 3.6 0 0 0 1.1 4.8c-.6 0-1.1-.2-1.6-.4 0 1.7 1.2 3.1 2.9 3.5-.5.1-1 .2-1.6.1a3.6 3.6 0 0 0 3.4 2.5A7.2 7.2 0 0 1 4 16.9a10.2 10.2 0 0 0 5.5 1.6c6.6 0 10.2-5.5 10.2-10.2v-.5c.7-.5 1.3-1.1 1.8-1.7z"/></g>'),

        mail: svg(lin('ml-bg', [[0, '#52cdff'], [1, '#0d66ee']]) + white('ml-w') + drop('ml-s'),
            bg('ml-bg') + '<g filter="url(#ml-s)"><rect x="10" y="17" width="44" height="31" rx="5" fill="url(#ml-w)"/><path d="M11.5 19.5L32 35l20.5-15.5" fill="none" stroke="#8fbff5" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></g>'),

        market: svg(lin('mk-bg', [[0, '#ffc566'], [1, '#ff6e12']]) + white('mk-w') + drop('mk-s'),
            bg('mk-bg') + '<g filter="url(#mk-s)" transform="translate(12 12) scale(1.67)"><path fill="url(#mk-w)" fill-rule="evenodd" d="M11.6 2.4L21 11.8a2 2 0 0 1 0 2.8l-6.4 6.4a2 2 0 0 1-2.8 0L2.4 11.6A2 2 0 0 1 1.8 10V4a2 2 0 0 1 2-2h6a2 2 0 0 1 1.8.4zM7 5.4A1.6 1.6 0 1 0 7 8.6 1.6 1.6 0 0 0 7 5.4z"/></g>'),

        services: svg(lin('sv-bg', [[0, '#44dccd'], [1, '#0c7d96']]) + white('sv-w') + drop('sv-s'),
            bg('sv-bg') + '<g filter="url(#sv-s)" fill="url(#sv-w)"><rect x="11" y="30" width="11" height="22" rx="1.5"/><rect x="24" y="14" width="14" height="38" rx="1.5"/><rect x="40" y="23" width="13" height="29" rx="1.5"/></g>'
            + '<g fill="#1fa7b0" opacity="0.55">' + [18, 23, 28, 33, 38, 43].map((y) => `<rect x="27" y="${y}" width="3" height="2.4" rx="0.6"/><rect x="32" y="${y}" width="3" height="2.4" rx="0.6"/>`).join('')
            + [28, 33, 38, 43].map((y) => `<rect x="43" y="${y}" width="3" height="2.4" rx="0.6"/><rect x="47.5" y="${y}" width="3" height="2.4" rx="0.6"/>`).join('')
            + [35, 40, 45].map((y) => `<rect x="14.5" y="${y}" width="4" height="2.4" rx="0.6"/>`).join('') + '</g>'),

        darkchat: svg(rad('dc-bg', [[0, '#4b23b8'], [0.55, '#1a0f3a'], [1, '#07060c']], 0.5, 0.95, 0.85) + lin('dc-w', [[0, '#ffffff'], [1, '#c9b8ff']]) + drop('dc-s', 1.5, 2, 0.5),
            bg('dc-bg') + '<g filter="url(#dc-s)" transform="translate(12 11) scale(1.67)"><path fill="url(#dc-w)" fill-rule="evenodd" d="M12 2a8 8 0 0 1 8 8v11.2l-2.7-2-2.6 2-2.7-2-2.7 2-2.6-2-2.7 2V10a8 8 0 0 1 8-8zM9 8.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></g>'),

        prism: svg(lin('pr-bg', [[0, '#ffd56b'], [0.35, '#ff7a3d'], [0.65, '#e1306c'], [1, '#7b3fe4']], 1, 1) + white('pr-w') + drop('pr-s'),
            bg('pr-bg') + '<g filter="url(#pr-s)"><path fill="url(#pr-w)" fill-rule="evenodd" d="M32 10.5l22.5 39H9.5zm0 9.5L18 44.5h28z"/><path fill="url(#pr-w)" opacity="0.85" d="M32 29l7.4 12.5H24.6z"/></g>'),

        garage: svg(lin('ga-bg', [[0, '#5a6680'], [1, '#1b2130']]) + lin('ga-c', [[0, '#ffffff'], [1, '#cfd6e2']]) + rad('ga-h', [[0, '#fff9d6'], [1, '#ffd23f']]) + drop('ga-s', 1.6, 1.6, 0.4),
            bg('ga-bg') + '<g filter="url(#ga-s)"><path fill="url(#ga-c)" d="M17 30l3.6-9.4c.8-2 2.7-3.3 4.9-3.3h13c2.2 0 4.1 1.3 4.9 3.3L47 30c2.8.9 4.8 3.5 4.8 6.6v9.4c0 1.3-1.1 2.4-2.4 2.4h-3.6c-1.3 0-2.4-1.1-2.4-2.4V44H20.6v2c0 1.3-1.1 2.4-2.4 2.4h-3.6c-1.3 0-2.4-1.1-2.4-2.4v-9.4c0-3.1 2-5.7 4.8-6.6z"/>'
            + '<path fill="#2b3446" d="M22.6 29.5l2.4-6.4c.3-.8 1.1-1.3 1.9-1.3h10.2c.8 0 1.6.5 1.9 1.3l2.4 6.4z"/><circle cx="20.6" cy="37" r="3.6" fill="url(#ga-h)"/><circle cx="43.4" cy="37" r="3.6" fill="url(#ga-h)"/><rect x="27" y="36" width="10" height="3" rx="1.5" fill="#8a94a8"/></g>'),

        music: svg(lin('mu-bg', [[0, '#ff6f87'], [1, '#f31d3c']]) + white('mu-w') + drop('mu-s'),
            bg('mu-bg') + '<g filter="url(#mu-s)" transform="translate(12 11.5) scale(1.67)"><path fill="url(#mu-w)" d="M9 19.2a3 3 0 1 1-2-2.8V6.5a1 1 0 0 1 .8-1l9.5-2a1 1 0 0 1 1.2 1v12a3 3 0 1 1-2-2.8V8.2l-7.5 1.6v9.4z"/></g>'),

        weather: svg(lin('we-bg', [[0, '#5ecbff'], [1, '#1d6ef2']]) + rad('we-sun', [[0, '#fff3a6'], [1, '#ffcc00']]) + white('we-w') + drop('we-s', 1.5, 1.6, 0.22),
            bg('we-bg') + '<circle cx="24" cy="24" r="10" fill="url(#we-sun)"/><g filter="url(#we-s)"><path fill="url(#we-w)" d="M24 48a8 8 0 0 1-.9-15.9A11 11 0 0 1 44.4 31 8.5 8.5 0 1 1 46 48z"/></g>'),

        appstore: svg(lin('as-bg', [[0, '#2bd1ff'], [1, '#0a62f0']]) + drop('as-s'),
            bg('as-bg') + '<g filter="url(#as-s)" stroke="#fff" stroke-width="4.6" stroke-linecap="round" fill="none"><path d="M26.5 16.5L41 43"/><path d="M37.5 16.5L23 43"/><path d="M15.5 39h33"/></g>'),

        match: svg(lin('mt-bg', [[0, '#ff5f6d'], [1, '#e6156b']], 1, 1) + white('mt-w') + drop('mt-s'),
            bg('mt-bg') + '<g filter="url(#mt-s)" transform="translate(12 10) scale(1.67)"><path fill="url(#mt-w)" d="M13.2 2.5c.4 2.8-.6 4.6-2 6.2-1.2 1.4-2.6 2.6-3.5 4.5A7.3 7.3 0 0 0 12 23.6a7.6 7.6 0 0 0 7.9-7.7c-.2-4.1-3.3-5.7-4-9-1.1.8-1.8 2.1-1.6 3.7-1.9-1.5-2.4-5-1.1-8.1z"/></g>'),

        game2048: svg(lin('g2-bg', [[0, '#f5d35a'], [1, '#e2ac17']]),
            bg('g2-bg') + '<text x="32" y="38.5" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="17" fill="#fff" letter-spacing="-0.5">2048</text>'),

        snake: svg(lin('sn-bg', [[0, '#2f8f3a'], [1, '#0f3d15']]) + lin('sn-b', [[0, '#b6f37a'], [1, '#62c43a']]),
            bg('sn-bg') + '<path d="M18 46h22a6 6 0 0 0 0-12H24a6 6 0 0 1 0-12h20" fill="none" stroke="url(#sn-b)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="44" cy="22" r="2" fill="#0f3d15"/><circle cx="48" cy="44" r="3.6" fill="#ff3b30"/><rect x="47.4" y="38.8" width="1.4" height="3" rx="0.7" fill="#5a3a1a"/>'),

        maps: svg(lin('mp-bg', [[0, '#f2f7ea'], [1, '#dfe9d2']]) + lin('mp-a', [[0, '#3b9bff'], [1, '#0060e6']]) + drop('mp-s', 1.4, 1.5, 0.3),
            bg('mp-bg') + '<path d="M-2 10c9 2 15-3 22 3s3 15 13 18-3 15 7 19" fill="none" stroke="#a7d97a" stroke-width="16" opacity="0.8"/><path d="M40 70c4-10 14-12 26-10v14z" fill="#8ccbf5"/>'
            + '<path d="M-4 52L68 8" stroke="#fff" stroke-width="9"/><path d="M-4 52L68 8" stroke="#f6c64a" stroke-width="3.2"/><path d="M14 -4l10 72" stroke="#fff" stroke-width="4.5"/>'
            + '<g filter="url(#mp-s)"><circle cx="40" cy="38" r="11" fill="#fff"/><path d="M40 29.5l6.2 14.5-6.2-3.4-6.2 3.4z" fill="url(#mp-a)"/></g>'),

        news: svg(lin('nw-bg', [[0, '#ff505a'], [1, '#c0101d']]) + white('nw-w') + drop('nw-s'),
            bg('nw-bg') + '<text filter="url(#nw-s)" x="31.5" y="44" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-style="italic" font-weight="900" font-size="34" fill="url(#nw-w)">W</text><rect x="17" y="49" width="30" height="2.6" rx="1.3" fill="#fff" opacity="0.85"/>'),

        crypto: svg(lin('cr-bg', [[0, '#2a2a30'], [1, '#09090b']]) + lin('cr-c', [[0, '#ffc04d'], [1, '#f07a0a']]) + drop('cr-s', 1.6, 1.8, 0.45),
            bg('cr-bg') + '<g filter="url(#cr-s)"><circle cx="32" cy="32" r="21" fill="url(#cr-c)"/><circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.4"/>'
            + '<g fill="#fff"><rect x="22.5" y="24" width="2" height="16" rx="1"/><rect x="21" y="27" width="5" height="9" rx="1.2"/><rect x="31" y="20" width="2" height="22" rx="1"/><rect x="29.5" y="24" width="5" height="11" rx="1.2"/><rect x="39.5" y="26" width="2" height="15" rx="1"/><rect x="38" y="30" width="5" height="7" rx="1.2"/></g></g>'),

        home: svg(lin('hm-bg', [[0, '#ffffff'], [1, '#eceef3']]) + lin('hm-h', [[0, '#ffbf2e'], [1, '#ff8a00']]) + drop('hm-s', 1.4, 1.4, 0.22),
            bg('hm-bg') + '<g filter="url(#hm-s)"><path fill="url(#hm-h)" d="M32 12.5L9.5 31.6c-1.3 1.1-.5 3.1 1.2 3.1H14V50a3 3 0 0 0 3 3h10.5V40.5h9V53H47a3 3 0 0 0 3-3V34.7h3.3c1.7 0 2.5-2 1.2-3.1z"/></g>'),
    };

    let serial = 0;
    function art(id) {
        const tpl = ART[id];
        if (!tpl) return null;
        serial += 1;
        return tpl.replace(/(id="|url\(#)([A-Za-z0-9-]+)/g, (m, lead, name) => lead + name + '-' + serial);
    }

    return { art, ids: () => Object.keys(ART) };
})();
