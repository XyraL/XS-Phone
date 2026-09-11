(() => {
    const ui = PhoneOS.ui;
    let myProfile;
    let currentScope = 'global';

    const appTitle = () => PhoneOS.appName('prism');

    async function loadMe(force) {
        if (myProfile !== undefined && !force) return myProfile;
        const res = await PhoneOS.api('social:me');
        myProfile = (res && res.ok && res.data) || null;
        return myProfile;
    }

    function postCard(view, p, opts = {}) {
        const card = document.createElement('div');
        card.className = 'prism-card';

        const head = document.createElement('div');
        head.className = 'prism-head';
        const av = ui.avatar(p.display || p.handle, 32, p.avatar);
        av.addEventListener('click', () => profileScreen(view, p.handle));
        const handle = document.createElement('span');
        handle.className = 'prism-head-handle';
        handle.textContent = p.handle + (p.verified ? ' ✓' : '');
        handle.addEventListener('click', () => profileScreen(view, p.handle));
        head.append(av, handle);

        if (p.mine) {
            const del = document.createElement('button');
            del.className = 'pc-delete';
            del.textContent = '✕';
            del.addEventListener('click', async () => {
                if (await ui.confirm(view, 'Delete this photo?', 'Delete')) {
                    await PhoneOS.api('prism:delete', { postId: p.id });
                    if (opts.onChange) opts.onChange();
                }
            });
            head.append(del);
        }
        card.append(head);

        const likesLine = document.createElement('div');
        likesLine.className = 'prism-likes';
        const like = document.createElement('button');
        like.className = 'prism-act';
        const paintLike = () => {
            like.textContent = p.liked ? '♥' : '♡';
            like.classList.toggle('liked', !!p.liked);
            likesLine.textContent = `${p.likes || 0} like${p.likes === 1 ? '' : 's'}`;
        };
        async function toggleLike(onlyLike) {
            if (onlyLike && p.liked) return;
            const res = await PhoneOS.api('prism:like', { postId: p.id });
            if (res && res.ok) {
                p.liked = res.liked;
                p.likes = (p.likes || 0) + (res.liked ? 1 : -1);
                paintLike();
            }
        }

        const imgWrap = document.createElement('div');
        imgWrap.className = 'prism-img-wrap';
        const img = document.createElement('img');
        img.className = 'prism-image';
        img.loading = 'lazy';
        img.src = p.image;
        const burst = document.createElement('div');
        burst.className = 'prism-burst';
        burst.textContent = '♥';
        imgWrap.append(img, burst);
        imgWrap.addEventListener('dblclick', () => {
            burst.classList.remove('pop');
            void burst.offsetWidth;
            burst.classList.add('pop');
            toggleLike(true);
        });
        card.append(imgWrap);

        const bar = document.createElement('div');
        bar.className = 'prism-actions';
        like.addEventListener('click', () => toggleLike(false));
        const comment = document.createElement('button');
        comment.className = 'prism-act';
        comment.textContent = '💬';
        comment.addEventListener('click', () => commentsScreen(view, p));
        bar.append(like, comment);
        card.append(bar);

        card.append(likesLine);
        paintLike();

        if (p.caption) {
            const cap = document.createElement('div');
            cap.className = 'prism-caption';
            const h = document.createElement('span');
            h.className = 'prism-cap-handle';
            h.textContent = p.handle;
            cap.append(h, document.createTextNode(' ' + p.caption));
            card.append(cap);
        }

        if (p.comments > 0) {
            const cl = document.createElement('div');
            cl.className = 'prism-comments-link';
            cl.textContent = `View all ${p.comments} comment${p.comments === 1 ? '' : 's'}`;
            cl.addEventListener('click', () => commentsScreen(view, p));
            card.append(cl);
        }

        const when = document.createElement('div');
        when.className = 'prism-when';
        when.textContent = ui.fmtWhen(p.at);
        card.append(when);
        return card;
    }

    async function feedScreen(view) {
        const fresh = PhoneOS.freshRender(view);
        const me = await loadMe();
        if (!fresh()) return;
        if (!me) { onboardingScreen(view); return; }

        view.textContent = '';
        view.append(ui.header(appTitle(), {
            action: { label: '+', onTap: () => composeScreen(view) },
        }));

        const seg = document.createElement('div');
        seg.className = 'feed-tabs';
        for (const [scope, labelText] of [['global', 'Explore'], ['following', 'Following']]) {
            const t = document.createElement('div');
            t.className = 'feed-tab' + (currentScope === scope ? ' selected' : '');
            t.textContent = labelText;
            t.addEventListener('click', () => { currentScope = scope; feedScreen(view); });
            seg.append(t);
        }
        const meBtn = document.createElement('div');
        meBtn.className = 'feed-tab';
        meBtn.textContent = 'Me';
        meBtn.addEventListener('click', () => profileScreen(view, me.handle));
        seg.append(meBtn);
        view.append(seg);

        const content = ui.content();
        content.classList.add('prism-content');
        const skel = ui.skeleton(3);
        view.append(skel);
        const res = await PhoneOS.api('prism:feed', { scope: currentScope });
        if (!fresh()) return;
        skel.remove();
        const posts = (res && res.ok && res.data) || [];

        if (!posts.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = currentScope === 'following'
                ? 'Nothing here — follow some people.' : 'No photos yet. Post the first one.';
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
            const res = await PhoneOS.api('prism:feed',
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

    async function composeScreen(view) {
        const photo = await PhoneOS.pickPhoto();
        if (!photo) return;

        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Cancel', onTap: () => feedScreen(view) } }));

        const content = ui.content();
        content.append(ui.label('New photo'));

        const preview = document.createElement('img');
        preview.className = 'prism-image prism-compose-preview';
        preview.src = photo.url;
        content.append(preview);

        const caption = ui.textInput({ placeholder: 'Write a caption…' });
        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(caption);
        content.append(form);

        const post = document.createElement('button');
        post.className = 'primary-btn';
        post.textContent = 'Share';
        post.addEventListener('click', async () => {
            post.disabled = true;
            const res = await PhoneOS.api('prism:post', {
                imageUrl: photo.url, caption: caption.value.trim(),
            });
            post.disabled = false;
            if (res && res.ok) {
                currentScope = 'global';
                feedScreen(view);
            } else {
                PhoneOS.notify({ app: 'prism', title: appTitle(), body: 'Couldn\'t share that.' });
            }
        });
        content.append(post);
        view.append(content);
    }

    async function commentsScreen(view, post) {
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        const head = ui.header('', { back: { label: appTitle(), onTap: () => feedScreen(view) } });
        const t = document.createElement('div');
        t.className = 'chat-title';
        t.textContent = 'Comments';
        head.insertBefore(t, head.querySelector('.ah-action'));
        view.append(head);

        const content = ui.content();

        const context = document.createElement('div');
        context.className = 'prism-c-context';
        const thumb = document.createElement('img');
        thumb.className = 'prism-c-thumb';
        thumb.src = post.image;
        const capWrap = document.createElement('div');
        capWrap.className = 'prism-c-main';
        const capLine = document.createElement('div');
        capLine.className = 'prism-c-body';
        const capHandle = document.createElement('span');
        capHandle.className = 'prism-cap-handle';
        capHandle.textContent = post.handle;
        capLine.append(capHandle);
        if (post.caption) capLine.append(document.createTextNode(' ' + post.caption));
        const capTime = document.createElement('div');
        capTime.className = 'prism-c-time';
        capTime.textContent = ui.fmtWhen(post.at);
        capWrap.append(capLine, capTime);
        context.append(thumb, capWrap);
        content.append(context);

        const res = await PhoneOS.api('prism:comments', { postId: post.id });
        if (!fresh()) return;
        const comments = (res && res.ok && res.data) || [];

        const list = document.createElement('div');
        if (!comments.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No comments yet. Say something nice.';
            list.append(empty);
        } else {
            for (const c of comments) list.append(commentRow(c));
        }
        content.append(list);
        view.append(content);

        const bar = document.createElement('div');
        bar.className = 'chat-inputbar';
        const input = ui.textInput({ placeholder: 'Add a comment…' });
        input.classList.add('chat-input');
        const send = document.createElement('button');
        send.className = 'chat-send';
        send.textContent = '›';
        bar.append(input, send);
        view.append(bar);

        async function doSend() {
            const body = input.value.trim();
            if (!body) return;
            const r = await PhoneOS.api('prism:comment', { postId: post.id, body });
            if (r && r.ok) {
                input.value = '';
                const empty = list.querySelector('.empty-state');
                if (empty) empty.remove();
                list.append(commentRow(r.data));
                post.comments = (post.comments || 0) + 1;
            }
        }
        send.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
        input.focus();
    }

    function commentRow(c) {
        const row = document.createElement('div');
        row.className = 'prism-comment';
        row.append(ui.avatar(c.display || c.handle, 32, c.avatar));

        const main = document.createElement('div');
        main.className = 'prism-c-main';
        const body = document.createElement('div');
        body.className = 'prism-c-body';
        const h = document.createElement('span');
        h.className = 'prism-cap-handle';
        h.textContent = c.handle;
        body.append(h, document.createTextNode(' ' + c.body));
        const time = document.createElement('div');
        time.className = 'prism-c-time';
        time.textContent = ui.fmtWhen(c.at);
        main.append(body, time);
        row.append(main);
        return row;
    }

    async function profileScreen(view, handle) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: appTitle(), onTap: () => feedScreen(view) } }));

        const fresh = PhoneOS.freshRender(view);
        const content = ui.content();
        content.classList.add('prism-content');
        const res = await PhoneOS.api('prism:profile', { handle });
        if (!fresh()) return;
        if (!res || !res.ok) { feedScreen(view); return; }
        const { profile, posts } = res.data;

        const head = document.createElement('div');
        head.className = 'ig-head';
        head.append(ui.avatar(profile.display || profile.handle, 78, profile.avatar));

        const stats = document.createElement('div');
        stats.className = 'ig-stats';
        const stat = (n, labelText) => {
            const s = document.createElement('div');
            s.className = 'ig-stat';
            const b = document.createElement('b');
            b.textContent = n;
            const l = document.createElement('span');
            l.textContent = labelText;
            s.append(b, l);
            return s;
        };
        stats.append(
            stat(profile.posts || 0, 'Posts'),
            stat(profile.followers || 0, 'Followers'),
            stat(profile.followingCount || 0, 'Following'));
        head.append(stats);
        content.append(head);

        const nameLine = document.createElement('div');
        nameLine.className = 'ig-name';
        nameLine.textContent = profile.display + (profile.verified ? ' ✓' : '');
        content.append(nameLine);
        if (profile.bio) {
            const bio = document.createElement('div');
            bio.className = 'ig-bio';
            bio.textContent = profile.bio;
            content.append(bio);
        }

        if (!profile.isMe) {
            const follow = document.createElement('button');
            follow.className = 'ig-follow' + (profile.following ? ' following' : '');
            follow.textContent = profile.following ? 'Following' : 'Follow';
            follow.addEventListener('click', async () => {
                const r = await PhoneOS.api('social:follow', { handle: profile.handle });
                if (r && r.ok) profileScreen(view, handle);
            });
            content.append(follow);
        }

        const grid = document.createElement('div');
        grid.className = 'prism-grid';
        for (const p of posts) {
            const cell = document.createElement('img');
            cell.className = 'prism-cell';
            cell.src = p.image;
            cell.addEventListener('click', () => {
                view.textContent = '';
                view.append(ui.header('', { back: { label: `@${handle}`, onTap: () => profileScreen(view, handle) } }));
                const c2 = ui.content();
                c2.classList.add('prism-content');
                c2.append(postCard(view, p, { onChange: () => profileScreen(view, handle) }));
                view.append(c2);
            });
            grid.append(cell);
        }
        if (!posts.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No photos yet.';
            content.append(empty);
        }
        content.append(grid);
        view.append(content);
    }

    function onboardingScreen(view) {
        view.textContent = '';
        view.append(ui.header(appTitle()));

        const content = ui.content();
        content.append(ui.authForm({
            title: appTitle(),
            sub: 'One account works across ' + PhoneOS.appName('social') + ' and ' + appTitle()
                + '. Log in from any phone and your profile follows you.',
            iconBg: 'linear-gradient(135deg,#e86ab4,#8b3fd1)',
            glyph: PhoneOS.glyphs.prism,
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
        id: 'prism', name: 'Prism', store: true,
        iconBg: 'linear-gradient(135deg,#e86ab4,#8b3fd1)',
        glyph: PhoneOS.glyphs.prism,
        render: feedScreen,
    });
})();
