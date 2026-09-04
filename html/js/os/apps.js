PhoneOS.apps = [];
PhoneOS.badges = {};

PhoneOS.registerApp = function (def) {
    PhoneOS.apps.push(def);
};

PhoneOS.getApp = function (id) {
    return PhoneOS.apps.find((a) => a.id === id) || null;
};

PhoneOS.bumpBadge = function (appId) {
    if (!PhoneOS.getApp(appId)) return;
    PhoneOS.badges[appId] = (PhoneOS.badges[appId] || 0) + 1;
    if (PhoneOS.renderBadges) PhoneOS.renderBadges();
};

PhoneOS.clearBadge = function (appId) {
    delete PhoneOS.badges[appId];
    if (PhoneOS.renderBadges) PhoneOS.renderBadges();
};

PhoneOS.clearBadges = function () {
    PhoneOS.badges = {};
    if (PhoneOS.renderBadges) PhoneOS.renderBadges();
};

PhoneOS.glyphs = {
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
    messages: '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.6 6.2-.2 1.1-.8 2.2-1.5 3 1.7-.2 3.3-.9 4.5-1.7 1.1.3 2.2.5 3.4.5 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>',
    contacts: '<svg viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2.2c-3.7 0-8 1.9-8 4.4V21h16v-2.4c0-2.5-4.3-4.4-8-4.4z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M4 7h9m3 0h4M4 12h3m3 0h10M4 17h13m3 0h0" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="14.5" cy="7" r="2.2"/><circle cx="8.5" cy="12" r="2.2"/><circle cx="19" cy="17" r="2.2"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M9 4l-1.2 2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.8L15 4H9zm3 4.5A4.5 4.5 0 1 1 12 17.5 4.5 4.5 0 0 1 12 8.5zm0 2A2.5 2.5 0 1 0 12 15.5 2.5 2.5 0 0 0 12 10.5z"/></svg>',
    gallery: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm11 4a1.6 1.6 0 1 1 0 3.2A1.6 1.6 0 0 1 16 8zM5 17l4.5-6 3.5 4.5 2.5-3L19 17H5z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4 5h14a2 2 0 0 1 2 2v1h-6a3 3 0 0 0 0 6h6v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm10 6h7v2h-7a1 1 0 0 1 0-2z"/></svg>',
    notes: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 5h8v1.8H8V8zm0 4h8v1.8H8V12zm0 4h5v1.8H8V16z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.9 5v5.3l4 2.4-.9 1.5-4.9-3V7h1.8z"/></svg>',
    calculator: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm1 3v3.4h10V5H7zm.2 6.2h2.2v2.2H7.2v-2.2zm3.7 0h2.2v2.2h-2.2v-2.2zm3.7 0h2.2v2.2h-2.2v-2.2zm-7.4 3.8h2.2V17H7.2v-2zm3.7 0h2.2V17h-2.2v-2zm3.7 0h2.2V17h-2.2v-2z"/></svg>',
    social: '<svg viewBox="0 0 24 24"><path d="M21.5 6.1c-.6.3-1.3.5-2 .6a3.5 3.5 0 0 0 1.6-1.9c-.7.4-1.5.7-2.3.9a3.6 3.6 0 0 0-6.2 3.3A10.2 10.2 0 0 1 5.2 5a3.6 3.6 0 0 0 1.1 4.8c-.6 0-1.1-.2-1.6-.4 0 1.7 1.2 3.1 2.9 3.5-.5.1-1 .2-1.6.1a3.6 3.6 0 0 0 3.4 2.5A7.2 7.2 0 0 1 4 16.9a10.2 10.2 0 0 0 5.5 1.6c6.6 0 10.2-5.5 10.2-10.2v-.5c.7-.5 1.3-1.1 1.8-1.7z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm8 6.7L4.3 7h15.4L12 11.7zm-8 1.5V17h16v-3.8l-8 4.8-8-4.8z"/></svg>',
    market: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M11.6 2.4L21 11.8a2 2 0 0 1 0 2.8l-6.4 6.4a2 2 0 0 1-2.8 0L2.4 11.6A2 2 0 0 1 1.8 10V4a2 2 0 0 1 2-2h6a2 2 0 0 1 1.8.4zM7 5.4A1.6 1.6 0 1 0 7 8.6 1.6 1.6 0 0 0 7 5.4z"/></svg>',
    services: '<svg viewBox="0 0 24 24"><path d="M21.3 6.2a5.4 5.4 0 0 1-7.2 5.4l-7.3 7.3a1.9 1.9 0 0 1-2.7-2.7l7.3-7.3a5.4 5.4 0 0 1 6.9-6.6L15 5.6l3.4 3.4 3.3-3.3c.3.8.5 1.6.5 2.5z" transform="rotate(3 12 12)"/></svg>',
    darkchat: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2a8 8 0 0 1 8 8v11.2l-2.7-2-2.6 2-2.7-2-2.7 2-2.6-2-2.7 2V10a8 8 0 0 1 8-8zM9 8.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
    keypad: '<svg viewBox="0 0 24 24"><path d="M7 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 14.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>',
    prism: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2.2L22 19.5H2L12 2.2zm0 4L5.5 17.5h13L12 6.2zm0 3.4l3.6 6.1H8.4L12 9.6z"/></svg>',
    garage: '<svg viewBox="0 0 24 24"><path d="M5 12l1.6-4.2A2 2 0 0 1 8.5 6.5h7a2 2 0 0 1 1.9 1.3L19 12a2 2 0 0 1 1.5 1.9v3.6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-.8H6.5v.8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-3.6A2 2 0 0 1 5 12zm2.1-.5h9.8l-1.2-3.2a.5.5 0 0 0-.5-.3h-6.4a.5.5 0 0 0-.5.3L7.1 11.5zM7 13.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm10 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9 19.2a3 3 0 1 1-2-2.8V6.5a1 1 0 0 1 .8-1l9.5-2a1 1 0 0 1 1.2 1v12a3 3 0 1 1-2-2.8V8.2l-7.5 1.6v9.4z"/></svg>',
    weather: '<svg viewBox="0 0 24 24"><path d="M8.5 6.8a5 5 0 0 1 9.5 1.4A4 4 0 0 1 17.5 16H7a4.5 4.5 0 0 1-1-8.9 5 5 0 0 1 2.5-.3zm1.6-1.5a6.5 6.5 0 0 0-1.9.9 3.5 3.5 0 1 1 5.6-4 3.5 3.5 0 0 1-.4 1.6 6.6 6.6 0 0 0-3.3 1.5z" opacity="0.95"/></svg>',
    appstore: '<svg viewBox="0 0 24 24"><path d="M12 2.5l1.8 3.1-4.9 8.5H4.4L12 2.5zm3.1 5.4l6.5 11.2h-3.6l-1.5-2.6h-4.4l1.8-3.1h.8L12.9 10l2.2-2.1zM6.2 16.5h2.5L7.3 19a1.8 1.8 0 0 1-3.1-1.8l2-.7z" transform="scale(0.92) translate(1 1)"/></svg>',
    match: '<svg viewBox="0 0 24 24"><path d="M13.2 2.5c.4 2.8-.6 4.6-2 6.2-1.2 1.4-2.6 2.6-3.5 4.5A7.3 7.3 0 0 0 12 23.6a7.6 7.6 0 0 0 7.9-7.7c-.2-4.1-3.3-5.7-4-9-1.1.8-1.8 2.1-1.6 3.7-1.9-1.5-2.4-5-1.1-8.1zM12 20.9a3.4 3.4 0 0 1-3.1-4.7c.4-1 1.2-1.7 2.3-2.8.9 1.4 3.9 2.3 3.9 4.5a3.2 3.2 0 0 1-3.1 3z"/></svg>',
    game2048: '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" opacity="0.95" rx="1"/></svg>',
    snake: '<svg viewBox="0 0 24 24"><path d="M5 6a3 3 0 0 1 3-3h8v3H8v3h8a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H8v3h8a4.7 4.7 0 0 0 1.6-.3V21a3 3 0 0 1-1.6.9H8a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h8V9H8a3 3 0 0 1-3-3z"/><circle cx="18.4" cy="4.6" r="1.4"/></svg>',
};

PhoneOS.appName = function (id) {
    const names = PhoneOS.state && PhoneOS.state.appNames;
    if (names && names[id]) return names[id];
    const def = PhoneOS.getApp(id);
    return def ? def.name : id;
};
