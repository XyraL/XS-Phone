(() => {
    const ui = PhoneOS.ui;
    let myProfile;      // undefined = unknown, null = none
    let currentTab = 'discover';
    let deck = [];
    let lastSwiped = null;

    const appTitle = () => PhoneOS.appName('match');

    async function loadMe(force) {
        if (myProfile !== undefined && !force) return myProfile;
        const res = await PhoneOS.api('match:me');
        myProfile = (res && res.ok && res.data) || null;
        return myProfile;
    }

    let pendingAuth = null;

    function authGate(view) {
        view.textContent = '';
        view.append(ui.header(appTitle()));
        const content = ui.content();
        content.append(ui.authForm({
            title: appTitle(),
            sub: 'Your dating account. Log in from any phone — your card, swipes and matches follow you.',
            iconBg: 'linear-gradient(135deg,#ff655b,#fd297b)',
            glyph: PhoneOS.glyphs.match,
            idPlaceholder: 'Username',
            onSubmit: async (mode, id, pw) => {
                if (mode === 'signup') {
                    pendingAuth = { username: id.toLowerCase(), password: pw };
                    profileEditor(view, null);
                    return null;
                }
                const res = await PhoneOS.api('match:login', { username: id.toLowerCase(), password: pw });
                if (res && res.ok) {
                    await loadMe(true);
                    deck = [];
                    currentTab = 'discover';
                    render(view);
                    return null;
                }
                return {
                    bad_login: 'Wrong username or password.',
                    rate_limited: 'Too many tries — wait a minute.',
                }[res && res.error] || 'Something went wrong.';
            },
        }));
        view.append(content);
    }

    async function render(view) {
        const me = await loadMe();
        if (!me) { authGate(view); return; }

        view.textContent = '';
        view.append(ui.header(appTitle()));

        const tabs = document.createElement('div');
        tabs.className = 'tinder-tabs';
        for (const [id, glyph] of [
            ['discover', PhoneOS.glyphs.match],
            ['matches', PhoneOS.glyphs.messages],
            ['profile', PhoneOS.glyphs.contacts],
        ]) {
            const t = document.createElement('div');
            t.className = 'tinder-tab' + (currentTab === id ? ' selected' : '');
            t.innerHTML = glyph;
            t.addEventListener('click', () => { currentTab = id; render(view); });
            tabs.append(t);
        }
        view.append(tabs);

        if (currentTab === 'discover') discoverTab(view);
        else if (currentTab === 'matches') matchesTab(view);
        else profileEditor(view, myProfile);
    }

    async function discoverTab(view) {
        const stage = document.createElement('div');
        stage.className = 'match-stage';
        view.append(stage);

        if (!deck.length) {
            const res = await PhoneOS.api('match:deck');
            deck = (res && res.ok && res.data) || [];
        }
        paintDeck(view, stage);
    }

    function paintDeck(view, stage) {
        stage.textContent = '';

        if (!deck.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state match-empty';
            empty.textContent = 'No one new around you right now.';
            const again = document.createElement('button');
            again.className = 'primary-btn';
            again.textContent = 'Look Again';
            again.addEventListener('click', async () => {
                const res = await PhoneOS.api('match:deck');
                deck = (res && res.ok && res.data) || [];
                paintDeck(view, stage);
            });
            stage.append(empty, again);
            return;
        }

        const person = deck[0];
        if (deck[1]) {
            const under = matchCard(deck[1], { preview: true });
            under.classList.add('match-under');
            stage.append(under);
        }
        const card = matchCard(person);
        stage.append(card);

        const controls = document.createElement('div');
        controls.className = 'tinder-controls';
        const btn = (cls, symbol, big) => {
            const b = document.createElement('button');
            b.className = 'tinder-btn ' + cls + (big ? ' big' : '');
            b.textContent = symbol;
            controls.append(b);
            return b;
        };
        const rewind = btn('tb-rewind', '↺');
        const pass = btn('tb-nope', '✕', true);
        const superBtn = btn('tb-super', '★');
        const like = btn('tb-like', '♥', true);
        const boost = btn('tb-boost', '⚡');
        stage.append(controls);

        let busy = false;
        async function commit(liked, superLike) {
            if (busy) return;
            busy = true;
            controls.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            deck.shift();
            const res = await PhoneOS.api('match:swipe',
                { token: person.token, liked, super: superLike === true });
            setTimeout(() => {
                if (res && res.ok && res.matched) {
                    lastSwiped = null;
                    matchMoment(view, stage, res.data || person);
                } else {
                    lastSwiped = res && res.ok ? person : null;
                    paintDeck(view, stage);
                }
            }, 240);
        }

        function flyOut(liked, superLike) {
            if (busy) return;
            card.style.transition = 'transform 0.3s ease-in, opacity 0.3s';
            card.style.transform = superLike
                ? 'translateY(-620px) rotate(0deg)'
                : `translateX(${liked ? 560 : -560}px) rotate(${liked ? 20 : -20}deg)`;
            card.style.opacity = '0';
            commit(liked, superLike);
        }
        pass.addEventListener('click', () => flyOut(false));
        like.addEventListener('click', () => flyOut(true));
        superBtn.addEventListener('click', () => flyOut(true, true));
        boost.addEventListener('click', () => {
            PhoneOS.notify({ app: 'match', title: appTitle(),
                body: 'Boost isn\'t available in your city yet.' });
        });
        rewind.addEventListener('click', async () => {
            if (busy || !lastSwiped) {
                rewind.classList.remove('bounce');
                void rewind.offsetWidth;
                rewind.classList.add('bounce');
                return;
            }
            const res = await PhoneOS.api('match:unswipe');
            if (res && res.ok) {
                deck.unshift(lastSwiped);
                lastSwiped = null;
                paintDeck(view, stage);
            }
        });

        const likeStamp = card.querySelector('.stamp-like');
        const nopeStamp = card.querySelector('.stamp-nope');
        let drag = null;

        card.addEventListener('pointerdown', (e) => {
            if (busy) return;
            drag = { x: e.clientX, y: e.clientY, moved: false };
            card.style.transition = 'none';
            try { card.setPointerCapture(e.pointerId); } catch (err) {  }
        });
        card.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
            card.style.transform =
                `translate(${dx}px, ${dy * 0.25}px) rotate(${dx / 16}deg)`;
            likeStamp.style.opacity = Math.min(1, Math.max(0, dx / 90));
            nopeStamp.style.opacity = Math.min(1, Math.max(0, -dx / 90));
        });
        card.addEventListener('pointerup', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x;
            const wasDrag = drag.moved;
            drag = null;
            if (Math.abs(dx) > 110) {
                flyOut(dx > 0);
                return;
            }
            card.style.transition = '';
            card.style.transform = '';
            likeStamp.style.opacity = 0;
            nopeStamp.style.opacity = 0;
            if (!wasDrag) {
                const rect = card.getBoundingClientRect();
                card.cyclePhoto(e.clientX - rect.left < rect.width * 0.4 ? -1 : 1);
            }
        });
    }

    function matchCard(person, opts = {}) {
        const card = document.createElement('div');
        card.className = 'match-card';

        let photoIdx = 0;
        const photo = document.createElement('div');
        photo.className = 'match-photo';

        const dotsBar = document.createElement('div');
        dotsBar.className = 'match-segs';
        for (let i = 0; i < person.photos.length; i++) {
            dotsBar.append(document.createElement('div'));
        }
        if (person.photos.length < 2) dotsBar.hidden = true;

        const paintPhoto = () => {
            photo.style.backgroundImage = person.photos[photoIdx]
                ? `url("${person.photos[photoIdx]}")` : 'none';
            [...dotsBar.children].forEach((d, i) =>
                d.classList.toggle('on', i === photoIdx));
        };
        card.cyclePhoto = (dir) => {
            const n = Math.max(1, person.photos.length);
            photoIdx = (photoIdx + dir + n) % n;
            paintPhoto();
        };

        const likeStamp = document.createElement('div');
        likeStamp.className = 'match-stamp stamp-like';
        likeStamp.textContent = 'LIKE';
        const nopeStamp = document.createElement('div');
        nopeStamp.className = 'match-stamp stamp-nope';
        nopeStamp.textContent = 'NOPE';

        const info = document.createElement('div');
        info.className = 'match-info';
        const name = document.createElement('div');
        name.className = 'match-name';
        name.textContent = `${person.name}, ${person.age}`;
        info.append(name);
        if (person.online) {
            const chip = document.createElement('div');
            chip.className = 'match-online';
            chip.textContent = 'Active now';
            info.append(chip);
        }
        if (person.bio) {
            const bio = document.createElement('div');
            bio.className = 'match-bio';
            bio.textContent = person.bio;
            info.append(bio);
        }

        card.append(photo, dotsBar, likeStamp, nopeStamp, info);
        paintPhoto();

        if (opts.preview) {
            card.classList.add('match-card-preview');
            photo.addEventListener('click', () => card.cyclePhoto(1));
        }
        return card;
    }

    function matchMoment(view, stage, person) {
        const overlay = document.createElement('div');
        overlay.className = 'match-moment';

        const hearts = document.createElement('div');
        hearts.className = 'mm-hearts';
        for (let i = 0; i < 7; i++) {
            const h = document.createElement('span');
            h.textContent = '♥';
            hearts.append(h);
        }

        const duo = document.createElement('div');
        duo.className = 'mm-duo';
        const mine = document.createElement('div');
        mine.className = 'mm-photo mm-mine';
        if (myProfile && myProfile.photos[0]) {
            mine.style.backgroundImage = `url("${myProfile.photos[0]}")`;
        }
        const theirs = document.createElement('div');
        theirs.className = 'mm-photo mm-theirs';
        if (person.photo || (person.photos && person.photos[0])) {
            theirs.style.backgroundImage = `url("${person.photo || person.photos[0]}")`;
        }
        duo.append(mine, theirs);

        const title = document.createElement('div');
        title.className = 'mm-title';
        title.textContent = 'It\'s a Match!';

        const sub = document.createElement('div');
        sub.className = 'mm-sub';
        sub.textContent = `You and ${person.name} liked each other.`;

        const msg = document.createElement('button');
        msg.className = 'mm-btn mm-btn-primary';
        msg.textContent = 'Send a Message';
        msg.addEventListener('click', () => {
            if (person.number) {
                PhoneOS.router.openApp('messages', null, { composeTo: person.number });
            } else {
                currentTab = 'matches';
                render(view);
            }
        });

        const keep = document.createElement('button');
        keep.className = 'mm-btn';
        keep.textContent = 'Keep Swiping';
        keep.addEventListener('click', () => {
            overlay.remove();
            paintDeck(view, stage);
        });

        overlay.append(hearts, duo, title, sub, msg, keep);
        view.append(overlay);
    }

    async function matchesTab(view) {
        const content = ui.content();
        const res = await PhoneOS.api('match:matches');
        const matches = (res && res.ok && res.data) || [];

        if (!matches.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No matches yet. Get swiping.';
            content.append(empty);
        } else {
            content.append(ui.label('Your matches'));
            const rail = document.createElement('div');
            rail.className = 'match-rail';
            for (const m of matches) {
                const cell = document.createElement('div');
                cell.className = 'match-rail-cell';
                const pic = document.createElement('div');
                pic.className = 'match-thumb match-rail-pic';
                if (m.photo) pic.style.backgroundImage = `url("${m.photo}")`;
                const nm = document.createElement('div');
                nm.className = 'match-rail-name';
                nm.textContent = m.name;
                cell.append(pic, nm);
                cell.addEventListener('click', () =>
                    PhoneOS.router.openApp('messages', null, { composeTo: m.number }));
                rail.append(cell);
            }
            content.append(rail);

            content.append(ui.group(matches.map((m) => {
                const row = document.createElement('div');
                row.className = 'list-row';

                const pic = document.createElement('div');
                pic.className = 'match-thumb';
                if (m.photo) pic.style.backgroundImage = `url("${m.photo}")`;

                const info = document.createElement('div');
                info.className = 'row-label';
                const who = document.createElement('div');
                who.textContent = `${m.name}, ${m.age}`;
                const when = document.createElement('div');
                when.className = 'match-when';
                when.textContent = `Matched ${ui.fmtWhen(m.at)}`;
                info.append(who, when);

                const message = document.createElement('button');
                message.className = 'contact-action';
                message.textContent = 'Message';
                message.addEventListener('click', () =>
                    PhoneOS.router.openApp('messages', null, { composeTo: m.number }));

                const un = document.createElement('button');
                un.className = 'pc-delete';
                un.textContent = '✕';
                un.addEventListener('click', async () => {
                    if (!await ui.confirm(view, `Unmatch ${m.name}?`, 'Unmatch')) return;
                    await PhoneOS.api('match:unmatch', { number: m.number });
                    render(view);
                });

                row.append(pic, info, message, un);
                return row;
            })));
        }
        view.append(content);
    }

    function profileEditor(view, existing) {
        view.textContent = '';
        view.append(ui.header(appTitle()));

        const content = ui.content();

        if (existing) {
            content.append(ui.label('How you appear'));
            const previewWrap = document.createElement('div');
            previewWrap.className = 'match-preview';
            previewWrap.append(matchCard(
                { name: existing.name, age: existing.age, bio: existing.bio,
                  photos: existing.photos, online: true },
                { preview: true }));
            content.append(previewWrap);

            const stats = document.createElement('div');
            stats.className = 'match-stats';
            const chip = (text) => {
                const c = document.createElement('div');
                c.className = 'match-stat';
                c.textContent = text;
                return c;
            };
            stats.append(chip(`${existing.photos.length} photo${existing.photos.length === 1 ? '' : 's'}`));
            stats.append(chip(existing.active ? 'Visible in Discover' : 'Hidden'));
            PhoneOS.api('match:matches').then((r) => {
                if (r && r.ok) {
                    stats.prepend(chip(`${r.data.length} match${r.data.length === 1 ? '' : 'es'}`));
                }
            });
            content.append(stats);
            content.append(ui.label('Edit your card'));
        } else {
            content.append(ui.label(`Welcome to ${appTitle()}`));
            const note = document.createElement('div');
            note.className = 'setup-sub';
            note.textContent = 'Set up a dating card. When two people like each other, they can message — matching shares your number.';
            content.append(note);
        }

        const nameInput = ui.textInput({ placeholder: 'Name', value: existing && existing.name });
        const ageNote = document.createElement('div');
        ageNote.className = 'setup-sub';
        ageNote.style.textAlign = 'left';
        ageNote.textContent = existing
            ? `Age ${existing.age} — pulled from your ID.`
            : 'Your age comes from your ID automatically.';
        const bioInput = ui.textInput({ placeholder: 'Bio', value: existing && existing.bio });
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(nameInput, ageNote, bioInput);
        content.append(form);

        content.append(ui.label('Photos (up to 3)'));
        let photos = existing ? [...existing.photos] : [];
        const strip = document.createElement('div');
        strip.className = 'match-photo-strip';
        function paintStrip() {
            strip.textContent = '';
            for (const [i, url] of photos.entries()) {
                const cell = document.createElement('div');
                cell.className = 'match-strip-cell';
                cell.style.backgroundImage = `url("${url}")`;
                cell.title = 'Tap to remove';
                cell.addEventListener('click', () => {
                    photos.splice(i, 1);
                    paintStrip();
                });
                strip.append(cell);
            }
            if (photos.length < 3) {
                const add = document.createElement('div');
                add.className = 'match-strip-cell match-strip-add';
                add.textContent = '+';
                add.addEventListener('click', async () => {
                    const photo = await PhoneOS.pickPhoto();
                    if (photo && !photos.includes(photo.url)) {
                        photos.push(photo.url);
                        paintStrip();
                    }
                });
                strip.append(add);
            }
        }
        paintStrip();
        content.append(strip);

        let active = existing ? existing.active : true;
        content.append(ui.label('Visibility'));
        content.append(ui.group([
            ui.row({ text: 'Show me in Discover', control: ui.toggle(active, (on) => { active = on; }) }),
        ]));

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const save = document.createElement('button');
        save.className = 'primary-btn';
        save.textContent = existing ? 'Save' : 'Start Matching';
        save.addEventListener('click', async () => {
            error.textContent = '';
            if (!existing && !pendingAuth) { authGate(view); return; }
            const payload = {
                name: nameInput.value.trim(),
                bio: bioInput.value.trim(),
                photos, active,
            };
            if (!existing) {
                payload.username = pendingAuth.username;
                payload.password = pendingAuth.password;
            }
            const res = await PhoneOS.api('match:saveProfile', payload);
            if (res && res.ok) {
                pendingAuth = null;
                await loadMe(true);
                deck = [];
                currentTab = 'discover';
                render(view);
                return;
            }
            error.textContent = {
                no_name: 'You need a name.',
                no_photos: 'Add at least one photo.',
                bad_username: 'Usernames are 3–15 characters: a-z, 0-9, underscores.',
                bad_password: 'Passwords are 4–32 characters.',
                taken: 'That username is taken.',
                rate_limited: 'Slow down a little.',
            }[res && res.error] || 'Couldn\'t save your profile.';
        });
        content.append(save);

        if (existing) {
            content.append(ui.label('Account'));
            content.append(ui.group([
                ui.row({ text: 'Log Out', danger: true, onTap: async () => {
                    if (!await ui.confirm(view, 'Log out of ' + appTitle() + '?', 'Log Out')) return;
                    await PhoneOS.api('match:logout');
                    myProfile = undefined;
                    deck = [];
                    currentTab = 'discover';
                    render(view);
                } }),
            ]));
        }
        view.append(content);
    }

    PhoneOS.on('phone:open', () => { myProfile = undefined; deck = []; });

    PhoneOS.registerApp({
        id: 'match', name: 'Sparks', store: true,
        iconBg: 'linear-gradient(135deg,#ff655b,#fd297b)',
        glyph: PhoneOS.glyphs.match,
        render,
    });
})();
