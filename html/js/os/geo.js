PhoneOS.geo = (() => {
    const MAP = {
        imageW: 4096,
        imageH: 6144,
        tile: 512,
        native: 4,
        world: { minX: -4140, maxX: 4860, minY: -5100, maxY: 8400 },
    };
    const W = MAP.world;

    function toPixel(x, y, zoom) {
        const scale = Math.pow(2, (zoom === undefined ? MAP.native : zoom) - MAP.native);
        return {
            px: ((x - W.minX) / (W.maxX - W.minX)) * MAP.imageW * scale,
            py: ((W.maxY - y) / (W.maxY - W.minY)) * MAP.imageH * scale,
        };
    }

    function fromPixel(px, py, zoom) {
        const scale = Math.pow(2, (zoom === undefined ? MAP.native : zoom) - MAP.native);
        return {
            x: W.minX + (px / scale / MAP.imageW) * (W.maxX - W.minX),
            y: W.maxY - (py / scale / MAP.imageH) * (W.maxY - W.minY),
        };
    }

    const ICONS = {
        pin: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
        home: '<svg viewBox="0 0 24 24"><path d="M12 3.2L2.5 11.4l1.3 1.5L5 11.9V20h5.5v-5.5h3V20H19v-8.1l1.2 1 1.3-1.5L12 3.2z"/></svg>',
        work: '<svg viewBox="0 0 24 24"><path d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 2v1h6V6H9z"/></svg>',
        star: '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8L12 2.8z"/></svg>',
        car: '<svg viewBox="0 0 24 24"><path d="M5 11l1.6-4.3A2 2 0 0 1 8.5 5.4h7a2 2 0 0 1 1.9 1.3L19 11a2 2 0 0 1 1.5 1.9v4.6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-.9h-11v.9a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-4.6A2 2 0 0 1 5 11zm2.2-.5h9.6l-1.1-3a.6.6 0 0 0-.6-.4H8.9a.6.6 0 0 0-.6.4l-1.1 3zM7 13a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 7 13zm10 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
        food: '<svg viewBox="0 0 24 24"><path d="M7 2h1.5v6.5H10V2h1.5v6.5c0 1.6-1.1 2.8-2.5 3V22H7.5V11.5C6.1 11.2 5 10 5 8.5V2h1.5v6.5H7V2zm9.5 0C18.4 2 20 4.5 20 8v5h-2.5v9H16V2h.5z"/></svg>',
        hospital: '<svg viewBox="0 0 24 24"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5V3z"/></svg>',
        police: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm0 5.2l-1.3 2.6-2.9.4 2.1 2-.5 2.9 2.6-1.4 2.6 1.4-.5-2.9 2.1-2-2.9-.4L12 7.2z"/></svg>',
        park: '<svg viewBox="0 0 24 24"><path d="M12 2l5.5 8H15l4 6h-6v6h-2v-6H5l4-6H6.5L12 2z"/></svg>',
        garage: '<svg viewBox="0 0 24 24"><path d="M21.3 6.2a5.4 5.4 0 0 1-7.2 5.4l-7.3 7.3a1.9 1.9 0 0 1-2.7-2.7l7.3-7.3a5.4 5.4 0 0 1 6.9-6.6L15 5.6l3.4 3.4 3.3-3.3c.3.8.5 1.6.5 2.5z"/></svg>',
        airport: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
        town: '<svg viewBox="0 0 24 24"><path d="M3 21V10l5-4 5 4v11h-3v-5H6v5H3zm11 0V8.5L18 5l3 2.6V21h-3v-4h-2v4h-2z"/></svg>',
    };

    const TINTS = {
        pin: '#ff453a', home: '#0a84ff', work: '#8e5cf7', star: '#ff9f0a', car: '#30b0c7', food: '#ff6b3d',
        hospital: '#ff375f', police: '#2f6bff', park: '#30b85a', garage: '#8e8e93', airport: '#5e5ce6', town: '#a2845e',
    };

    function icon(kind) { return ICONS[kind] || ICONS.pin; }
    function tint(kind) { return TINTS[kind] || TINTS.pin; }

    function thumb(x, y, w, h, zoom) {
        const z = zoom === undefined ? MAP.native : zoom;
        const box = document.createElement('div');
        box.className = 'geo-thumb';
        box.style.width = w + 'px';
        box.style.height = h + 'px';
        const p = toPixel(x, y, z);
        const left = p.px - w / 2;
        const top = p.py - h / 2;
        const scale = Math.pow(2, z - MAP.native);
        const lastX = Math.ceil((MAP.imageW * scale) / MAP.tile) - 1;
        const lastY = Math.ceil((MAP.imageH * scale) / MAP.tile) - 1;
        for (let tx = Math.floor(left / MAP.tile); tx <= Math.floor((left + w) / MAP.tile); tx++) {
            for (let ty = Math.floor(top / MAP.tile); ty <= Math.floor((top + h) / MAP.tile); ty++) {
                if (tx < 0 || ty < 0 || tx > lastX || ty > lastY) continue;
                const img = document.createElement('img');
                img.src = `assets/maps/tiles/${z}_${tx}_${ty}.webp`;
                img.style.left = (tx * MAP.tile - left) + 'px';
                img.style.top = (ty * MAP.tile - top) + 'px';
                img.draggable = false;
                box.append(img);
            }
        }
        const pin = document.createElement('div');
        pin.className = 'geo-thumb-pin';
        pin.innerHTML = ICONS.pin;
        box.append(pin);
        return box;
    }

    function distance(a, b) {
        if (!a || !b) return null;
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function fmtDistance(m) {
        if (m === null || m === undefined || !isFinite(m)) return '';
        if (m < 1000) return Math.max(10, Math.round(m / 10) * 10) + ' m';
        return (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
    }

    return { MAP, toPixel, fromPixel, thumb, icon, tint, distance, fmtDistance, ICONS };
})();
