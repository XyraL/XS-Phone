window.PhoneOS = {
    IN_GAME: typeof GetParentResourceName === 'function',
    state: null,          // { number, settings, os, version } — set on phone:open
    handlers: {},
};

PhoneOS.resource = PhoneOS.IN_GAME ? GetParentResourceName() : 'XS-Phone';

PhoneOS.nui = async function (name, data) {
    if (!PhoneOS.IN_GAME) return PhoneOS.mock(name, data);
    try {
        const res = await fetch(`https://${PhoneOS.resource}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
        });
        return await res.json();
    } catch (e) {
        console.error(`[XS-Phone] nui ${name} failed`, e);
        return { ok: false, error: 'transport' };
    }
};

PhoneOS.on = function (action, fn) {
    (PhoneOS.handlers[action] = PhoneOS.handlers[action] || []).push(fn);
};

PhoneOS.dispatch = function (action, data) {
    for (const fn of PhoneOS.handlers[action] || []) {
        try { fn(data); } catch (e) {
            console.error(`[XS-Phone] ${action} handler failed`, e);
        }
    }
};

window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.action) return;
    PhoneOS.dispatch(msg.action, msg.data);
});

document.addEventListener('focusin', (e) => {
    if (e.target.matches('input, textarea')) PhoneOS.nui('keepInput', { keep: false });
});
document.addEventListener('focusout', (e) => {
    if (e.target.matches('input, textarea')) PhoneOS.nui('keepInput', { keep: true });
});

PhoneOS.mock = function (name, data) {
    switch (name) {
        case 'saveSettings':
            console.log('[dev] saveSettings', data);
            return { ok: true };
        case 'close':
            return { ok: true };
        default:
            return { ok: true };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (PhoneOS.IN_GAME) return;
    document.body.classList.add('dev');

    const fitPreview = () => {
        const s = Math.min(1, (innerHeight - 24) / 780, (innerWidth - 24) / 360);
        document.getElementById('phone-root').style.transform = `scale(${s})`;
    };
    fitPreview();
    window.addEventListener('resize', fitPreview);
    setTimeout(() => {
        PhoneOS.dispatch('phone:open', {
            number: '555-0142',
            hasPin: false,
            settings: {
                wallpaper: 'aurora', ringtone: 'horizon', texttone: 'pop',
                theme: 'dark', accent: 'blue', textScale: 'default',
                time24: false, lockPreviews: true, dropEnabled: true,
                airplane: false, dnd: false,
                setupDone: !window.location.search.includes('setup=1'),
            },
            installedApps: ['social', 'prism', 'market', 'music', 'weather'],
            os: 'XyraLOS',
            appNames: { social: 'Chirp', darkchat: 'DarkChat' },
            version: '0.8.0-dev',
            badges: { messages: 1, mail: 1 },
        });
        setTimeout(() => PhoneOS.notify({
            app: 'messages', title: 'Vinny', body: 'You still coming to the docks tonight?',
        }), 2200);
        setTimeout(() => PhoneOS.notify({
            app: 'phone', title: 'Missed call', body: 'Unknown — 555-0199',
        }), 3600);
    }, 350);
});
