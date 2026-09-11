(() => {
    const ui = PhoneOS.ui;
    let myProfile;         // cached; null = confirmed absent
    let currentScope = 'global';

    const appTitle = () => PhoneOS.appName('social');

    async function loadMe(force) {
        if (myProfile !== undefined && !force) return myProfile;
        const res = await PhoneOS.api('social:me');
        myProfile = (res && res.ok && res.data) || null;
        return myProfile;
    }

    function postCard(view, p, opts = {}) {
        const card = document.createElement('div');
        card.className = 'post-card';

        const av = ui.avatar(p.display || p.handle, 40, p.avatar);
        av.classList.add('pc-av');
        av.addEventListener('click', (e) => {
            e.stopPropagation();
            profileScreen(view, p.handle);
        });
        card.append(av);

        const main = document.createElement('div');
        main.className = 'pc-main';

        const head = document.createElement('div');
        head.className = 'pc-head';
        const display = document.createElement('span');
        display.className = 'pc-display';
        display.textContent = p.display;
        if (p.verified) {
            const v = document.createElement('span');
            v.className = 'pc-verified';
            v.textContent = '✓';
            display.append(v);
        }
        const handle = document.createElement('span');
        handle.className = 'pc-handle';
        handle.textContent = `@${p.handle} · ${ui.fmtWhen(p.at)}`;
        head.append(display, handle);

        if (p.mine) {
            const del = document.createElement('button');
            del.className = 'pc-delete';
            del.textContent = '✕';
            del.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await ui.confirm(view, 'Delete this post?', 'Delete')) {
                    await PhoneOS.api('social:delete', { postId: p.id });
                    if (opts.onChange) opts.onChange();
                }
            });
            head.append(del);
        }
        main.append(head);

        if (p.body) {
            const body = document.createElement('div');
            body.className = 'pc-body';
            body.textContent = p.body;
            main.append(body);
        }
        if (p.image) {
            const img = document.createElement('img');
            img.className = 'pc-image';
            img.loading = 'lazy';
            img.src = p.image;
            main.append(img);
        }

        const bar = document.createElement('div');
        bar.className = 'pc-actions';

        const reply = document.createElement('button');
        reply.className = 'pc-action';
        reply.textContent = `💬 ${p.replies || 0}`;

        const like = document.createElement('button');
        like.className = 'pc-action' + (p.liked ? ' liked' : '');
        like.textContent = `♥ ${p.likes || 0}`;
        like.addEventListener('click', async (e) => {
            e.stopPropagation();
            const res = await PhoneOS.api('social:like', { postId: p.id });
            if (res && res.ok) {
                p.liked = res.liked;
                p.likes = (p.likes || 0) + (res.liked ? 1 : -1);
                like.textContent = `♥ ${p.likes}`;
                like.classList.toggle('liked', p.liked);
            }
        });

        bar.append(reply, like);
        main.append(bar);
        card.append(main);

        if (!opts.noThread) {
            card.addEventListener('click', () => threadScreen(view, p.id));
        }
        return card;
    }

    function composer(view, opts, done) {
        const overlay = document.createElement('div');
        overlay.className = 'picker-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'picker-sheet';

        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = opts.replyTo ? 'Reply' : 'New post';

        const input = document.createElement('textarea');
        input.className = 'text-input composer-input';
        input.placeholder = opts.replyTo ? 'Post your reply…' : 'What\'s happening?';
        input.maxLength = 280;

        let imageUrl = null;
        const preview = document.createElement('img');
        preview.className = 'composer-preview';
        preview.hidden = true;

        const row = document.createElement('div');
        row.className = 'composer-row';
        const attach = document.createElement('button');
        attach.className = 'contact-action';
        attach.textContent = '📷 Photo';
        attach.addEventListener('click', async () => {
            const photo = await PhoneOS.pickPhoto();
            if (photo) {
                imageUrl = photo.url;
                preview.src = photo.url;
                preview.hidden = false;
            }
        });
        const post = document.createElement('button');
        post.className = 'primary-btn composer-post';
        post.textContent = 'Post';
        post.addEventListener('click', async () => {
            const body = input.value.trim();
            if (!body && !imageUrl) return;
            post.disabled = true;
            const res = await PhoneOS.api('social:post',
                { body, imageUrl, replyTo: opts.replyTo });
            post.disabled = false;
            if (res && res.ok) {
                overlay.remove();
                done();
            } else {
                PhoneOS.notify({ app: 'social', title: appTitle(), body: 'Couldn\'t post that.' });
            }
        });
        row.append(attach, post);

        const cancel = document.createElement('button');
        cancel.className = 'confirm-btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => overlay.remove());

        sheet.append(title, input, preview, row, cancel);
        overlay.append(sheet);
        document.getElementById('phone-screen').append(overlay);
        input.focus();
    }

    async function feedScreen(view) {
        const fresh = PhoneOS.freshRender(view);
        const me = await loadMe();
        if (!fresh()) return;
        if (!me) { onboardingScreen(view); return; }

        view.textContent = '';
        view.append(ui.header(appTitle(), {
            action: { label: '+', onTap: () => composer(view, {}, () => feedScreen(view)) },
        }));

        const seg = document.createElement('div');
        seg.className = 'feed-tabs';
        for (const [scope, labelText] of [['global', 'Everyone'], ['following', 'Following']]) {
            const t = document.createElement('div');
            t.className = 'feed-tab' + (currentScope === scope ? ' selected' : '');
            t.textContent = labelText;
            t.addEventListener('click', () => {
                currentScope = scope;
                feedScreen(view);
            });
            seg.append(t);
        }
        const meBtn = document.createElement('div');
        meBtn.className = 'feed-tab';
        meBtn.textContent = 'Me';
        meBtn.addEventListener('click', () => profileScreen(view, me.handle));
        seg.append(meBtn);
        view.append(seg);

        const content = ui.content();
        content.classList.add('tw-content');
        const skel = ui.skeleton(4);
        view.append(skel);
        const res = await PhoneOS.api('social:feed', { scope: currentScope });
        if (!fresh()) return;
        skel.remove();
        const posts = (res && res.ok && res.data) || [];

        if (!posts.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = currentScope === 'following'
                ? 'Nothing here — follow some people.' : 'Nobody has posted yet. Be first.';
            content.append(empty);
        } else {
            for (const p of posts) {
                content.append(postCard(view, p, { onChange: () => feedScreen(view) }));
            }
            appendLoadMore(view, content, posts);
        }
        view.append(content);
    }

    function appendLoadMore(view, content, posts) {
        if (posts.length < 30) return;
        const more = document.createElement('button');
        more.className = 'load-earlier';
        more.textContent = 'Load more';
        more.addEventListener('click', async () => {
            more.disabled = true;
            const res = await PhoneOS.api('social:feed',
                { scope: currentScope, before: posts[posts.length - 1].id });
            const older = (res && res.ok && res.data) || [];
            more.remove();
            for (const p of older) {
                content.append(postCard(view, p, { onChange: () => feedScreen(view) }));
            }
            appendLoadMore(view, content, older);
        });
        content.append(more);
    }

    async function threadScreen(view, postId) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: appTitle(), onTap: () => feedScreen(view) } }));

        const content = ui.content();
        content.classList.add('tw-content');
        const res = await PhoneOS.api('social:thread', { postId });
        if (!res || !res.ok) { feedScreen(view); return; }

        content.append(postCard(view, res.data.post,
            { noThread: true, onChange: () => feedScreen(view) }));

        const replyBtn = document.createElement('button');
        replyBtn.className = 'primary-btn';
        replyBtn.textContent = 'Reply';
        replyBtn.addEventListener('click', () =>
            composer(view, { replyTo: postId }, () => threadScreen(view, postId)));
        content.append(replyBtn);

        if (res.data.replies.length) {
            content.append(ui.label('Replies'));
            for (const r of res.data.replies) {
                content.append(postCard(view, r,
                    { noThread: true, onChange: () => threadScreen(view, postId) }));
            }
        }
        view.append(content);
    }

    async function profileScreen(view, handle) {
        view.textContent = '';

        const back = document.createElement('button');
        back.className = 'tw-float-btn';
        back.textContent = '‹';
        back.addEventListener('click', () => feedScreen(view));
        view.append(back);

        const fresh = PhoneOS.freshRender(view);
        const content = ui.content();
        content.classList.add('tw-content', 'tw-profile');
        const res = await PhoneOS.api('social:profile', { handle });
        if (!fresh()) return;
        if (!res || !res.ok) { feedScreen(view); return; }
        const { profile, posts } = res.data;

        const banner = document.createElement('div');
        banner.className = 'tw-banner';
        if (profile.banner) {
            banner.style.backgroundImage = `url("${String(profile.banner).replace(/"/g, '%22')}")`;
        }
        content.append(banner);

        const headRow = document.createElement('div');
        headRow.className = 'tw-head-row';
        const av = ui.avatar(profile.display || profile.handle, 84, profile.avatar);
        av.classList.add('tw-avatar');
        headRow.append(av);

        if (profile.isMe) {
            const edit = document.createElement('button');
            edit.className = 'contact-action tw-action';
            edit.textContent = 'Edit Profile';
            edit.addEventListener('click', () => editProfileScreen(view, profile));
            headRow.append(edit);
        } else {
            const follow = document.createElement('button');
            follow.className = 'contact-action tw-action' + (profile.following ? '' : ' follow-btn');
            follow.textContent = profile.following ? 'Following' : 'Follow';
            follow.addEventListener('click', async () => {
                const r = await PhoneOS.api('social:follow', { handle: profile.handle });
                if (r && r.ok) profileScreen(view, handle);
            });
            headRow.append(follow);
        }
        content.append(headRow);

        const info = document.createElement('div');
        info.className = 'tw-info';
        const name = document.createElement('div');
        name.className = 'tw-name';
        name.textContent = profile.display;
        if (profile.verified) {
            const v = document.createElement('span');
            v.className = 'pc-verified';
            v.textContent = '✓';
            name.append(v);
        }
        const handleEl = document.createElement('div');
        handleEl.className = 'tw-handle';
        handleEl.textContent = `@${profile.handle}`;
        info.append(name, handleEl);
        if (profile.bio) {
            const bio = document.createElement('div');
            bio.className = 'tw-bio';
            bio.textContent = profile.bio;
            info.append(bio);
        }

        const counts = document.createElement('div');
        counts.className = 'tw-counts';
        const count = (n, labelText) => {
            const c = document.createElement('span');
            const b = document.createElement('b');
            b.textContent = n;
            c.append(b, document.createTextNode(' ' + labelText));
            return c;
        };
        counts.append(
            count(profile.followingCount || 0, 'Following'),
            count(profile.followers || 0, profile.followers === 1 ? 'Follower' : 'Followers'),
            count(profile.posts || 0, profile.posts === 1 ? 'Post' : 'Posts'));
        info.append(counts);
        content.append(info);

        content.append(ui.label('Posts'));
        if (!posts.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No posts yet.';
            content.append(empty);
        } else {
            for (const p of posts) {
                content.append(postCard(view, p, { onChange: () => profileScreen(view, handle) }));
            }
        }
        view.append(content);
    }

    function editProfileScreen(view, profile) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Profile', onTap: () => profileScreen(view, profile.handle) } }));

        const content = ui.content();
        content.classList.add('tw-content');

        let avatarUrl = profile.avatar || null;
        let bannerUrl = profile.banner || null;

        const banner = document.createElement('div');
        banner.className = 'tw-banner tw-editable';
        const bannerHint = document.createElement('div');
        bannerHint.className = 'tw-edit-hint';
        banner.append(bannerHint);

        const headRow = document.createElement('div');
        headRow.className = 'tw-head-row';
        let av;

        function paintImages() {
            banner.style.backgroundImage = bannerUrl
                ? `url("${String(bannerUrl).replace(/"/g, '%22')}")` : '';
            bannerHint.textContent = bannerUrl ? 'Tap to remove banner' : 'Tap to add a banner';
            if (av) av.remove();
            av = ui.avatar(profile.display || profile.handle, 78, avatarUrl);
            av.classList.add('tw-avatar', 'tw-editable');
            av.title = avatarUrl ? 'Tap to remove photo' : 'Tap to add a photo';
            av.addEventListener('click', async () => {
                if (avatarUrl) {
                    avatarUrl = null;
                } else {
                    const photo = await PhoneOS.pickPhoto();
                    if (photo) avatarUrl = photo.url;
                }
                paintImages();
            });
            headRow.prepend(av);
        }
        banner.addEventListener('click', async () => {
            if (bannerUrl) {
                bannerUrl = null;
            } else {
                const photo = await PhoneOS.pickPhoto();
                if (photo) bannerUrl = photo.url;
            }
            paintImages();
        });
        paintImages();
        content.append(banner, headRow);

        const avatarHint = document.createElement('div');
        avatarHint.className = 'tw-edit-hint tw-avatar-hint';
        avatarHint.textContent = 'Tap the photo or banner to change them';
        content.append(avatarHint);

        content.append(ui.label('Edit profile'));
        const displayInput = ui.textInput({ placeholder: 'Display name', value: profile.display });
        const bioInput = ui.textInput({ placeholder: 'Bio', value: profile.bio || '' });
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(displayInput, bioInput);
        content.append(form);

        const save = document.createElement('button');
        save.className = 'primary-btn';
        save.textContent = 'Save';
        save.addEventListener('click', async () => {
            const res = await PhoneOS.api('social:updateProfile', {
                display: displayInput.value.trim(),
                bio: bioInput.value.trim(),
                avatarUrl,
                bannerUrl,
            });
            if (res && res.ok) {
                await loadMe(true);
                profileScreen(view, profile.handle);
            }
        });
        content.append(save);

        content.append(ui.label('Account'));
        content.append(ui.group([
            ui.row({ text: 'Log Out', danger: true, onTap: async () => {
                if (!await ui.confirm(view, `Log out of @${profile.handle}?`, 'Log Out')) return;
                await PhoneOS.api('social:logout');
                myProfile = undefined;
                feedScreen(view);
            } }),
        ]));
        view.append(content);
    }

    function onboardingScreen(view) {
        view.textContent = '';
        view.append(ui.header(appTitle()));

        const content = ui.content();
        content.append(ui.authForm({
            title: appTitle(),
            sub: 'One account works across ' + appTitle() + ' and ' + PhoneOS.appName('prism')
                + '. Log in from any phone and your profile follows you.',
            iconBg: 'linear-gradient(135deg,#4aa8e8,#1d76c4)',
            glyph: PhoneOS.glyphs.social,
            idPlaceholder: '@handle',
            extraFields: [{ key: 'display', placeholder: 'Display name' }],
            onSubmit: async (mode, id, pw, extra) => {
                const handle = id.replace(/^@/, '').toLowerCase();
                const res = mode === 'signup'
                    ? await PhoneOS.api('social:createProfile',
                        { handle, password: pw, display: extra.display, bio: '' })
                    : await PhoneOS.api('social:login', { handle, password: pw });
                if (res && res.ok) {
                    myProfile = res.data || undefined;
                    await loadMe(true);
                    feedScreen(view);
                    return null;
                }
                return {
                    bad_handle: 'Handles are 3–15 characters: a-z, 0-9, underscores.',
                    bad_password: 'Passwords are 4–32 characters.',
                    taken: 'That handle is taken.',
                    bad_login: 'Wrong handle or password.',
                    rate_limited: 'Too many tries — wait a minute.',
                }[res && res.error] || 'Something went wrong.';
            },
        }));
        view.append(content);
    }

    PhoneOS.on('phone:open', () => { myProfile = undefined; });

    PhoneOS.registerApp({
        id: 'social', name: 'Chirp', store: true,
        iconBg: 'linear-gradient(135deg,#4aa8e8,#1d76c4)',
        glyph: PhoneOS.glyphs.social,
        render: feedScreen,
    });
})();
