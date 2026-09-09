(() => {
    const ME = '555-0142';
    let nextId = 100;
    let mockPin = null;
    let mockBalance = 24350;
    let mockCall = null;

    const db = {
        contacts: [
            { id: 1, number: '555-0199', name: 'Vinny', favorite: 1, blocked: 0 },
            { id: 2, number: '555-0777', name: 'Big Tuna', favorite: 0, blocked: 0 },
            { id: 3, number: '555-0333', name: 'Rosa Delgado', favorite: 1, blocked: 0 },
            { id: 4, number: '555-0911', name: 'Tow Guy Marv', favorite: 0, blocked: 1 },
        ],
        threads: [
            {
                id: 10, isGroup: 0, name: null, others: ['555-0199'], muted: 0, unread: 1,
                messages: [
                    { id: 50, sender: '555-0199', body: 'Yo. Docks tonight?', sentAt: Date.now() - 7200000 },
                    { id: 51, sender: ME, body: 'Depends. Who else is coming?', sentAt: Date.now() - 7000000 },
                    { id: 52, sender: '555-0199', body: 'Just us and Tuna. Bring the van.', sentAt: Date.now() - 600000 },
                ],
            },
            {
                id: 11, isGroup: 1, name: 'Crew', others: ['555-0199', '555-0777'], muted: 0, unread: 0,
                messages: [
                    { id: 40, sender: '555-0777', body: 'Who moved my boat', sentAt: Date.now() - 86400000 * 2 },
                    { id: 41, sender: ME, body: 'Not me chief', sentAt: Date.now() - 86400000 * 2 + 60000 },
                ],
            },
            {
                id: 12, isGroup: 0, name: null, others: ['BANK'], muted: 0, unread: 0,
                messages: [
                    { id: 30, sender: 'BANK', body: 'Your account was credited $2,500.', sentAt: Date.now() - 86400000 * 4 },
                ],
            },
        ],
        photos: [
            { id: 70, url: 'https://picsum.photos/seed/dock/430/780', at: Date.now() - 7200000 },
            { id: 71, url: 'https://picsum.photos/seed/city/430/780', at: Date.now() - 86400000 },
            { id: 72, url: 'https://picsum.photos/seed/beach/430/780', at: Date.now() - 86400000 * 3 },
        ],
        calls: [
            { number: '555-0199', direction: 'in', state: 'completed', duration: 154, at: Date.now() - 3600000 },
            { number: '555-0777', direction: 'out', state: 'missed', duration: 0, at: Date.now() - 7200000 },
            { number: 'Anonymous', direction: 'in', state: 'missed', duration: 0, at: Date.now() - 86400000 },
        ],
        transactions: [
            { other: '555-0199', direction: 'out', amount: 500, note: 'gas money', at: Date.now() - 3600000 },
            { other: '555-0333', direction: 'in', amount: 2200, note: null, at: Date.now() - 86400000 },
        ],
        notes: [
            { id: 80, title: 'Van plates', body: 'Blue Youga — 58ADR422\nCheck with Marv about the lift', at: Date.now() - 86400000 },
        ],
        alarms: [
            { id: 90, time: '07:30', label: 'Shift start', enabled: 1 },
        ],
        myProfile: null,
        socialPosts: [
            { id: 200, handle: 'lsnews', display: 'LS News', verified: true, body: 'Traffic on the Olympic Fwy after a 6-car pileup. Avoid if you can.', image: null, at: Date.now() - 5400000, likes: 12, liked: false, replies: 2, mine: false },
            { id: 201, handle: 'bigtuna', display: 'Big Tuna', verified: false, body: 'someone stole my boat again. not saying names. VINNY.', image: null, at: Date.now() - 9000000, likes: 34, liked: true, replies: 5, mine: false },
            { id: 202, handle: 'rosa_d', display: 'Rosa Delgado', verified: false, body: 'Sunset from the pier tonight 🌅', image: 'https://picsum.photos/seed/pier/430/300', at: Date.now() - 86400000, likes: 58, liked: false, replies: 3, mine: false },
        ],
        mailAddress: null,
        emails: {
            inbox: [
                { id: 300, fromAddress: 'cityhall@ls.mail', toAddress: 'me@ls.mail', subject: 'Vehicle registration renewal', body: 'Your registration for plate 58ADR422 expires this week.\n\nRenew at any city hall kiosk.', image: null, isRead: false, at: Date.now() - 3600000 },
                { id: 301, fromAddress: 'vinny@ls.mail', toAddress: 'me@ls.mail', subject: 'that thing we talked about', body: 'dont text this. mail only.\n\nfriday. docks. bring the van.', image: null, isRead: true, at: Date.now() - 86400000 },
            ],
            sent: [],
        },
        market: [
            { id: 400, seller: '555-0777', title: 'Boat trailer, barely used', body: 'Selling because SOMEONE keeps taking the boat. Good condition.', price: 3500, image: 'https://picsum.photos/seed/trailer/430/300', at: Date.now() - 7200000, mine: false },
            { id: 401, seller: ME, title: 'Phone case, brand new', body: 'Wrong size for my phone. Never used.', price: 50, image: null, at: Date.now() - 86400000, mine: true },
        ],
        city: [
            { job: 'police', label: 'LSPD', category: 'Emergency', emergency: true, number: '911', open: true, onDuty: 4, announcement: null, isBoss: false },
            { job: 'ambulance', label: 'Pillbox Medical', category: 'Emergency', emergency: true, number: '912', open: true, onDuty: 2, announcement: null, isBoss: false },
            { job: 'mechanic', label: 'Los Santos Customs', category: 'Vehicles', emergency: false, number: '555-0100', open: true, onDuty: 2, announcement: 'Half-price resprays until 8pm', isBoss: true },
            { job: 'taxi', label: 'Downtown Cab Co.', category: 'Transport', emergency: false, number: '555-0200', open: false, onDuty: 0, announcement: null, isBoss: false },
            { job: 'burgershot', label: 'Burger Shot', category: 'Food & Drink', emergency: false, number: '555-0300', open: true, onDuty: 3, announcement: null, isBoss: false },
        ],
        darkRooms: [
            { id: 500, code: 'K7XR2Q', name: 'the yard', handle: 'ghost_204', members: 4 },
        ],
        darkMessages: [
            { id: 510, handle: 'viper_881', body: 'shipment moved to thursday', at: Date.now() - 3600000 },
            { id: 511, handle: 'ghost_204', body: 'copy. same spot?', at: Date.now() - 3500000 },
            { id: 512, handle: 'viper_881', body: 'new spot. check your mail', at: Date.now() - 3400000 },
        ],
        prismPosts: [
            { id: 600, handle: 'rosa_d', display: 'Rosa Delgado', verified: false, image: 'https://picsum.photos/seed/pier2/430/430', caption: 'golden hour never misses', at: Date.now() - 5400000, likes: 41, liked: false, comments: 2, mine: false },
            { id: 601, handle: 'lsnews', display: 'LS News', verified: true, image: 'https://picsum.photos/seed/city/430/430', caption: 'Vinewood tonight.', at: Date.now() - 86400000, likes: 118, liked: true, comments: 9, mine: false },
        ],
        prismComments: [
            { id: 610, handle: 'bigtuna', display: 'Big Tuna', body: 'where is this??', mine: false, at: Date.now() - 5000000 },
            { id: 611, handle: 'rosa_d', display: 'Rosa Delgado', body: 'del perro 🌊', mine: false, at: Date.now() - 4900000 },
        ],
        garage: [
            { model: 'sultan', plate: '58ADR422', garage: 'Legion Square', state: 1, fuel: 82, engine: 96, body: 88 },
            { model: 'youga', plate: 'CPHR 001', garage: null, state: 0, fuel: 34, engine: 61, body: 44 },
            { model: 'bati801', plate: 'FAST BOI', garage: 'Impound', state: 2, fuel: 12, engine: 22, body: 18 },
        ],
        music: [
            { id: 700, title: 'Late Night Drive', url: 'https://example.com/track1.mp3' },
            { id: 701, title: 'Radio Mirror Park Mix', url: 'https://example.com/track2.mp3' },
        ],
        installed: ['social', 'prism', 'market', 'music', 'weather'],
        matchProfile: null,
        matchDeck: [
            { token: 'a1', name: 'Rosa', age: 27, bio: 'Sunsets, fast cars, bad decisions.', online: true,
              photos: ['https://picsum.photos/seed/rosa1/430/560', 'https://picsum.photos/seed/rosa2/430/560'] },
            { token: 'b2', name: 'Marcus', age: 31, bio: 'Gym. Docks. Repeat.', online: false,
              photos: ['https://picsum.photos/seed/marcus/430/560'] },
            { token: 'c3', name: 'Jamie', age: 24, bio: 'Ask me about my Youga.', online: true,
              photos: ['https://picsum.photos/seed/jamie/430/560'] },
        ],
        matches: [],
    };

    const ok = (data, extra) => ({ ok: true, data, ...(extra || {}) });
    const err = (e) => ({ ok: false, error: e });
    const thread = (id) => db.threads.find((t) => t.id === Number(id));

    const normalize = (input) => {
        const digits = String(input || '').replace(/\D/g, '');
        if (digits.length !== 7) return null;
        return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    };

    const api = {
        'contacts:list': () =>
            ok([...db.contacts].sort((a, b) => b.favorite - a.favorite || a.name.localeCompare(b.name))),
        'contacts:add': (d) => {
            const number = normalize(d.number);
            if (!number) return err('bad_number');
            if (db.contacts.some((c) => c.number === number)) return err('exists');
            const c = { id: nextId++, number, name: d.name, avatar: d.avatarUrl || null, favorite: 0, blocked: 0 };
            db.contacts.push(c);
            return ok(c);
        },
        'contacts:update': (d) => {
            const number = normalize(d.number);
            if (!number) return err('bad_number');
            const c = db.contacts.find((x) => x.id === d.id);
            if (c) { c.name = d.name; c.number = number; c.avatar = d.avatarUrl || null; }
            return ok();
        },
        'contacts:delete': (d) => {
            db.contacts = db.contacts.filter((x) => x.id !== d.id);
            return ok();
        },
        'contacts:favorite': (d) => {
            const c = db.contacts.find((x) => x.id === d.id);
            if (c) c.favorite = 1 - c.favorite;
            return ok();
        },
        'contacts:block': (d) => {
            const c = db.contacts.find((x) => x.id === d.id);
            if (c) c.blocked = 1 - c.blocked;
            return ok();
        },

        'messages:threads': () =>
            ok(db.threads.map((t) => {
                const last = t.messages[t.messages.length - 1];
                return {
                    id: t.id, isGroup: t.isGroup, name: t.name, others: t.others,
                    muted: t.muted, unread: t.unread,
                    lastBody: last && last.body, lastSender: last && last.sender,
                    lastAt: last && last.sentAt,
                };
            }), { me: ME }),
        'messages:getThread': (d) => {
            const t = thread(d.threadId);
            if (!t) return err('not_member');
            t.unread = 0;
            return ok({ messages: t.messages, hasMore: false });
        },
        'messages:markRead': (d) => {
            const t = thread(d.threadId);
            if (t) t.unread = 0;
            return ok();
        },
        'messages:send': (d) => {
            let t = d.threadId ? thread(d.threadId) : null;
            if (!t && d.to) {
                const to = normalize(d.to) || d.to;
                t = db.threads.find((x) => !x.isGroup && x.others[0] === to);
                if (!t) {
                    t = { id: nextId++, isGroup: 0, name: null, others: [to], muted: 0, unread: 0, messages: [] };
                    db.threads.unshift(t);
                }
            }
            if (!t) return err('invalid_number');
            const m = { id: nextId++, threadId: t.id, sender: ME, body: d.body,
                media: d.mediaUrl || null, sentAt: Date.now() };
            t.messages.push(m);
            return ok(m);
        },
        'messages:createGroup': (d) => {
            const t = {
                id: nextId++, isGroup: 1, name: d.name, others: d.members,
                muted: 0, unread: 0, messages: [],
            };
            db.threads.unshift(t);
            return ok({ threadId: t.id });
        },
        'drop:send': (d) => {
            const names = { 3: 'Rosa Delgado', 8: 'Marcus Reed' };
            setTimeout(() => PhoneOS.dispatch('phone:notify', {
                app: 'contacts', title: 'Drop',
                body: `${names[d.targetId] || 'They'} saved your card.`,
            }), 2000);
            return ok();
        },

        'messages:toggleMute': (d) => {
            const t = thread(d.threadId);
            if (t) t.muted = 1 - t.muted;
            return ok();
        },
        'messages:leave': (d) => {
            db.threads = db.threads.filter((x) => x.id !== Number(d.threadId));
            return ok();
        },

        'calls:start': (d) => {
            const raw = String(d.to || '');
            const anon = raw.startsWith('*67');
            const to = normalize(anon ? raw.slice(3) : raw);
            if (!to) return err('invalid_number');
            mockCall = { callId: ++nextId, number: to, direction: 'out' };
            setTimeout(() => {
                if (mockCall) PhoneOS.dispatch('phone:callState', { phase: 'active', callId: mockCall.callId });
            }, 1800);
            return ok({ callId: mockCall.callId });
        },
        'calls:answer': (d) => {
            if (mockCall) PhoneOS.dispatch('phone:callState', { phase: 'active', callId: mockCall.callId });
            return ok();
        },
        'calls:decline': (d) => {
            if (mockCall) {
                db.calls.unshift({ number: mockCall.number, direction: mockCall.direction, state: 'declined', duration: 0, at: Date.now() });
                PhoneOS.dispatch('phone:callState', { phase: 'ended', callId: mockCall.callId, reason: 'declined' });
                mockCall = null;
            }
            return ok();
        },
        'calls:hangup': (d) => {
            if (mockCall) {
                db.calls.unshift({ number: mockCall.number, direction: mockCall.direction, state: 'completed', duration: 12, at: Date.now() });
                PhoneOS.dispatch('phone:callState', { phase: 'ended', callId: mockCall.callId, reason: 'hangup' });
                mockCall = null;
            }
            return ok();
        },
        'calls:history': () => ok(db.calls),

        'pin:verify': (d) => ({ ok: true, valid: mockPin === null || mockPin === String(d.pin) }),
        'pin:set': (d) => {
            if (mockPin !== null && mockPin !== String(d.current || '')) return err('wrong_pin');
            mockPin = d.pin === null || d.pin === undefined ? null : String(d.pin);
            return { ok: true, hasPin: mockPin !== null };
        },

        'gallery:list': () => ok([...db.photos]),
        'gallery:save': (d) => {
            const p = { id: ++nextId, url: d.url, at: Date.now() };
            db.photos.unshift(p);
            return ok(p);
        },
        'gallery:delete': (d) => {
            db.photos = db.photos.filter((p) => p.id !== d.id);
            return ok();
        },

        'wallet:summary': () => ok({ balance: mockBalance, transactions: [...db.transactions] }),
        'wallet:transfer': (d) => {
            const to = normalize(d.to);
            if (!to) return err('invalid_number');
            const amount = Math.floor(Number(d.amount) || 0);
            if (amount < 1) return err('bad_amount');
            if (amount > mockBalance) return err('insufficient');
            mockBalance -= amount;
            db.transactions.unshift({ other: to, direction: 'out', amount, note: d.note || null, at: Date.now() });
            return ok({ balance: mockBalance });
        },

        'notes:list': () => ok([...db.notes]),
        'notes:save': (d) => {
            if (d.id) {
                const n = db.notes.find((x) => x.id === d.id);
                if (n) { n.title = d.title || 'Untitled'; n.body = d.body; n.at = Date.now(); }
                return ok({ id: d.id });
            }
            const n = { id: ++nextId, title: d.title || 'Untitled', body: d.body, at: Date.now() };
            db.notes.unshift(n);
            return ok({ id: n.id });
        },
        'notes:delete': (d) => {
            db.notes = db.notes.filter((n) => n.id !== d.id);
            return ok();
        },

        'alarms:list': () => ok([...db.alarms]),
        'alarms:save': (d) => {
            if (!/^\d\d:\d\d$/.test(d.time || '')) return err('bad_time');
            const a = { id: ++nextId, time: d.time, label: d.label || null, enabled: 1 };
            db.alarms.push(a);
            db.alarms.sort((x, y) => x.time.localeCompare(y.time));
            return ok({ id: a.id });
        },
        'alarms:toggle': (d) => {
            const a = db.alarms.find((x) => x.id === d.id);
            if (a) a.enabled = 1 - a.enabled;
            return ok();
        },
        'alarms:delete': (d) => {
            db.alarms = db.alarms.filter((a) => a.id !== d.id);
            return ok();
        },

        'social:me': () => ok(db.myProfile),
        'social:updateProfile': (d) => {
            if (db.myProfile) {
                db.myProfile.display = d.display;
                db.myProfile.bio = d.bio;
                db.myProfile.avatar = d.avatarUrl || null;
                db.myProfile.banner = d.bannerUrl || null;
            }
            return ok();
        },
        'social:createProfile': (d) => {
            if (!/^[a-z0-9_]{3,15}$/.test(d.handle || '')) return err('bad_handle');
            db.myProfile = { handle: d.handle, display: d.display || d.handle, bio: d.bio || '', verified: false };
            return ok(db.myProfile);
        },
        'social:feed': (d) => ok(d.scope === 'following'
            ? db.socialPosts.filter((p) => p.mine || p.handle === 'bigtuna')
            : [...db.socialPosts]),
        'social:post': (d) => {
            const p = {
                id: ++nextId, handle: db.myProfile.handle, display: db.myProfile.display,
                verified: false, body: d.body, image: d.imageUrl || null, replyTo: d.replyTo || null,
                at: Date.now(), likes: 0, liked: false, replies: 0, mine: true,
            };
            db.socialPosts.unshift(p);
            return ok({ id: p.id });
        },
        'social:like': (d) => {
            const p = db.socialPosts.find((x) => x.id === d.postId);
            if (!p) return err('gone');
            p.liked = !p.liked;
            p.likes += p.liked ? 1 : -1;
            return { ok: true, liked: p.liked };
        },
        'social:delete': (d) => {
            db.socialPosts = db.socialPosts.filter((x) => x.id !== d.postId);
            return ok();
        },
        'social:thread': (d) => {
            const post = db.socialPosts.find((x) => x.id === d.postId);
            if (!post) return err('gone');
            const replies = db.socialPosts.filter((x) => x.replyTo === d.postId);
            return ok({ post, replies });
        },
        'social:profile': (d) => {
            const posts = db.socialPosts.filter((p) => p.handle === d.handle && !p.replyTo);
            const mine = db.myProfile && db.myProfile.handle === d.handle;
            const base = mine ? db.myProfile
                : (posts[0] || db.socialPosts.find((p) => p.handle === d.handle));
            if (!base) return err('gone');
            return ok({
                profile: {
                    handle: d.handle, display: base.display, bio: base.bio || '',
                    avatar: base.avatar || null,
                    banner: base.banner || (d.handle === 'lsnews' ? 'https://picsum.photos/seed/skyline/430/160' : null),
                    verified: !!base.verified, isMe: !!mine,
                    following: d.handle === 'bigtuna', followers: mine ? 3 : 12,
                    followingCount: mine ? 8 : 41, posts: posts.length,
                },
                posts,
            });
        },
        'social:follow': () => ({ ok: true, following: true }),

        'mail:me': () => ok({ address: db.mailAddress, domain: 'ls.mail' }),
        'mail:signup': (d) => {
            if (!/^[a-z0-9_.]{3,30}$/.test(d.username || '')) return err('bad_username');
            if ((d.password || '').length < 4) return err('bad_password');
            db.mailAddress = d.username + '@ls.mail';
            db.emails.inbox.unshift({ id: ++nextId, fromAddress: 'welcome@ls.mail',
                toAddress: db.mailAddress, subject: 'Welcome to your inbox',
                body: 'This is your new address:\n\n' + db.mailAddress, image: null,
                isRead: false, at: Date.now() });
            return ok({ address: db.mailAddress });
        },
        'mail:login': (d) => {
            if ((d.password || '').length < 4) return err('bad_login');
            db.mailAddress = (d.username || 'me').replace(/@.*$/, '') + '@ls.mail';
            return ok({ address: db.mailAddress });
        },
        'mail:logout': () => { db.mailAddress = null; return ok(); },
        'mail:list': (d) => ok([...(db.emails[(d && d.folder) || 'inbox'] || [])]),
        'mail:send': (d) => {
            if (!/@/.test(d.to || '') && !/^[a-z0-9_.]{3,}$/.test(d.to || '')) return err('invalid_address');
            if (!d.subject || !d.body) return err('empty');
            const to = /@/.test(d.to) ? d.to : d.to + '@ls.mail';
            db.emails.sent.unshift({ id: ++nextId, fromAddress: db.mailAddress, toAddress: to,
                subject: d.subject, body: d.body, image: d.imageUrl || null, isRead: true, at: Date.now() });
            return ok();
        },
        'mail:read': (d) => {
            const m = db.emails.inbox.find((x) => x.id === d.id);
            if (m) m.isRead = true;
            return ok();
        },
        'mail:delete': (d) => {
            db.emails.inbox = db.emails.inbox.filter((x) => x.id !== d.id);
            db.emails.sent = db.emails.sent.filter((x) => x.id !== d.id);
            return ok();
        },

        'social:login': (d) => {
            if ((d.password || '').length < 4) return err('bad_login');
            db.myProfile = { handle: d.handle, display: d.handle, bio: '', verified: false };
            return ok(db.myProfile);
        },
        'social:logout': () => { db.myProfile = null; return ok(); },
        'match:login': (d) => {
            if ((d.password || '').length < 4) return err('bad_login');
            db.matchProfile = { username: d.username, name: 'Xy', age: 26, bio: '',
                photos: ['https://picsum.photos/seed/me/430/560'], active: true };
            return ok();
        },
        'match:logout': () => { db.matchProfile = null; return ok(); },

        'market:list': () => ok([...db.market]),
        'market:post': (d) => {
            if (!d.title || !d.body) return err('empty');
            db.market.unshift({ id: ++nextId, seller: ME, title: d.title, body: d.body,
                price: d.price || 0, image: d.imageUrl || null, at: Date.now(), mine: true });
            return ok({ id: nextId });
        },
        'market:delete': (d) => {
            db.market = db.market.filter((x) => x.id !== d.id);
            return ok();
        },

        'city:list': () => ok([...db.city]),
        'city:setAnnouncement': (d) => {
            const biz = db.city.find((b) => b.isBoss);
            if (biz) biz.announcement = d.text || null;
            return ok();
        },

        'phone:changeNumber': () => {
            const fresh = '555-0' + String(Math.floor(Math.random() * 900) + 100);
            return ok({
                number: fresh, hasPin: mockPin !== null, settings: PhoneOS.state.settings,
                os: 'XyraLOS', appNames: { social: 'Chirp', darkchat: 'DarkChat', prism: 'Prism', match: 'Sparks', services: 'City' },
                installedApps: [...db.installed], version: '0.12.0-dev', badges: {},
            });
        },

        'darkchat:rooms': () => ok([...db.darkRooms]),
        'darkchat:create': (d) => {
            if (!d.name) return err('bad_name');
            const room = { id: ++nextId, code: 'NEW' + String(nextId).slice(-3),
                name: d.name, handle: d.alias || 'cinder_' + (nextId % 1000), members: 1 };
            db.darkRooms.unshift(room);
            return ok(room);
        },
        'darkchat:join': (d) => {
            if ((d.code || '').toUpperCase() === 'K7XR2Q') return err('already');
            return err('gone');
        },
        'darkchat:messages': (d) => {
            if (d.roomId !== 500) return ok({ messages: [], myHandle: 'cinder_1' });
            return ok({ messages: [...db.darkMessages], myHandle: 'ghost_204' });
        },
        'darkchat:send': (d) => {
            const m = { id: ++nextId, roomId: d.roomId, handle: 'ghost_204', body: d.body, at: Date.now() };
            if (d.roomId === 500) db.darkMessages.push(m);
            return ok(m);
        },
        'darkchat:leave': (d) => {
            db.darkRooms = db.darkRooms.filter((r) => r.id !== d.roomId);
            return ok();
        },

        'prism:feed': (d) => ok(d.scope === 'following'
            ? db.prismPosts.filter((p) => p.mine || p.handle === 'lsnews')
            : [...db.prismPosts]),
        'prism:post': (d) => {
            db.prismPosts.unshift({
                id: ++nextId, handle: db.myProfile.handle, display: db.myProfile.display,
                verified: false, image: d.imageUrl, caption: d.caption || null,
                at: Date.now(), likes: 0, liked: false, comments: 0, mine: true,
            });
            return ok({ id: nextId });
        },
        'prism:like': (d) => {
            const p = db.prismPosts.find((x) => x.id === d.postId);
            if (!p) return err('gone');
            p.liked = !p.liked;
            p.likes += p.liked ? 1 : -1;
            return { ok: true, liked: p.liked };
        },
        'prism:comments': () => ok([...db.prismComments]),
        'prism:comment': (d) => {
            const c = { id: ++nextId, handle: db.myProfile.handle, display: db.myProfile.display,
                body: d.body, mine: true, at: Date.now() };
            db.prismComments.push(c);
            return ok(c);
        },
        'prism:delete': (d) => {
            db.prismPosts = db.prismPosts.filter((x) => x.id !== d.postId);
            return ok();
        },
        'prism:profile': (d) => {
            const posts = db.prismPosts.filter((p) => p.handle === d.handle);
            const mine = db.myProfile && db.myProfile.handle === d.handle;
            const base = mine ? db.myProfile : posts[0];
            if (!base) return err('gone');
            return ok({
                profile: { handle: d.handle, display: base.display, verified: !!base.verified,
                    isMe: !!mine, following: d.handle === 'lsnews', posts: posts.length },
                posts,
            });
        },

        'garage:list': () => ok({
            vehicles: [...db.garage],
            ping: { enabled: true },
            valet: { enabled: true, cost: 250 },
        }),
        'music:list': () => ok([...db.music]),
        'music:add': (d) => {
            if (!d.title) return err('empty');
            if (!/^https?:\/\//.test(d.url || '')) return err('bad_url');
            const t = { id: ++nextId, title: d.title, url: d.url };
            db.music.push(t);
            return ok(t);
        },
        'music:delete': (d) => {
            db.music = db.music.filter((t) => t.id !== d.id);
            return ok();
        },

        'store:install': (d) => {
            if (!db.installed.includes(d.id)) db.installed.push(d.id);
            return ok({ installed: [...db.installed] });
        },
        'store:uninstall': (d) => {
            db.installed = db.installed.filter((a) => a !== d.id);
            return ok({ installed: [...db.installed] });
        },

        'gallery:importUrl': (d) => {
            let host = '';
            try { host = new URL(d.url).host; } catch (e) { return err('bad_host'); }
            if (!['cdn.discordapp.com', 'media.discordapp.net', 'i.imgur.com', 'picsum.photos'].includes(host)) {
                return err('bad_host');
            }
            const photo = { id: ++nextId, url: d.url, at: Date.now() };
            db.photos.unshift(photo);
            return ok(photo);
        },

        'match:me': () => ok(db.matchProfile),
        'match:saveProfile': (d) => {
            if (!d.name) return err('no_name');
            if (!d.photos || !d.photos.length) return err('no_photos');
            db.matchProfile = { name: d.name, age: 26, bio: d.bio || '', photos: d.photos, active: d.active !== false };
            return ok();
        },
        'match:deck': () => ok([...db.matchDeck]),
        'match:swipe': (d) => {
            const person = db.matchDeck.find((p) => p.token === d.token);
            db.matchDeck = db.matchDeck.filter((p) => p.token !== d.token);
            if (person) db.lastSwipedPerson = person;
            if (!d.liked || !person) return { ok: true, matched: false };
            if (person.name === 'Rosa') {
                db.matches.unshift({ number: '555-0301', name: person.name, age: person.age,
                    photo: person.photos[0], at: Date.now() });
                return { ok: true, matched: true,
                    data: { name: person.name, photo: person.photos[0], number: '555-0301' } };
            }
            return { ok: true, matched: false };
        },
        'match:unswipe': () => {
            if (db.lastSwipedPerson) {
                db.matchDeck.unshift(db.lastSwipedPerson);
                db.lastSwipedPerson = null;
            }
            return ok();
        },
        'match:matches': () => ok([...db.matches]),
        'match:unmatch': (d) => {
            db.matches = db.matches.filter((m) => m.number !== d.number);
            return ok();
        },

        'garage:ping': () => ok({ x: 215.8, y: -810.1 }),
        'garage:valet': (d) => {
            const v = db.garage.find((x) => x.plate === d.plate);
            if (v) v.state = 0;
            setTimeout(() => PhoneOS.dispatch('phone:notify', {
                app: 'garage', title: 'Valet', body: 'Your car has arrived outside.',
            }), 3000);
            return ok({ cost: 250, delay: 3 });
        },
    };

    PhoneOS.mock = function (name, payload) {
        if (name === 'api') {
            const fn = api[payload.name];
            const res = fn ? fn(payload.data || {}) : err('unknown_api');
            console.log('[dev] api', payload.name, payload.data || '', '→', res);
            return res;
        }
        if (name === 'saveSettings') {
            console.log('[dev] saveSettings', payload);
            return ok();
        }
        if (name === 'dropScan') {
            return ok([
                { id: 3, name: 'Rosa Delgado', dist: 2 },
                { id: 8, name: 'Marcus Reed', dist: 7 },
            ]);
        }
        if (name === 'cameraCapture') {
            return { ok: true, url: `https://picsum.photos/seed/shot${Date.now() % 1000}/430/780` };
        }
        if (name === 'getWeather') {
            return { ok: true, weather: 'CLEAR', hour: 14, minute: 20 };
        }
        if (name === 'setWaypoint') {
            console.log('[dev] setWaypoint', payload);
            return ok();
        }
        if (name === 'dropRespond') {
            if (payload && payload.accept) {
                db.contacts.push({ id: nextId++, number: '555-0850', name: 'Marcus Reed', favorite: 0, blocked: 0 });
                PhoneOS.dispatch('phone:notify', {
                    app: 'contacts', title: 'Contact added', body: 'Marcus Reed · 555-0850',
                });
                PhoneOS.dispatch('phone:contactsChanged');
            }
            return ok();
        }
        return ok();
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (PhoneOS.IN_GAME) return;
        setTimeout(() => {
            const t = thread(10);
            const m = { id: nextId++, threadId: 10, sender: '555-0199', body: 'And don\'t be late this time', sentAt: Date.now() };
            t.messages.push(m);
            t.unread += 1;
            PhoneOS.dispatch('phone:newMessage', { threadId: 10, message: m });
        }, 8000);

        setTimeout(() => {
            PhoneOS.dispatch('phone:dropOffer', { name: 'Marcus Reed' });
        }, 14000);

        setTimeout(() => {
            if (mockCall) return;
            mockCall = { callId: ++nextId, number: '555-0199', direction: 'in' };
            PhoneOS.dispatch('phone:callState', {
                phase: 'incoming', callId: mockCall.callId, number: '555-0199',
            });
        }, 30000);
    });
})();
