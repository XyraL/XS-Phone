(() => {
    const ui = PhoneOS.ui;
    let category = 'All';
    let cache = null;

    const ERRORS = {
        empty: 'A headline and a story are both needed.',
        not_reporter: 'Only reporters can publish.',
        bad_media: 'That photo isn’t in your gallery.',
        rate_limited: 'Slow down a little.',
    };

    function masthead(canWrite, onWrite) {
        const head = document.createElement('div');
        head.className = 'nw-head';
        const brand = document.createElement('div');
        brand.className = 'nw-brand';
        const mark = document.createElement('div');
        mark.className = 'nw-mark';
        mark.textContent = 'W';
        const word = document.createElement('div');
        word.className = 'nw-word';
        word.textContent = PhoneOS.appName('news');
        brand.append(mark, word);
        head.append(brand);
        if (canWrite) {
            const write = document.createElement('button');
            write.className = 'nw-write';
            write.textContent = '+';
            write.title = 'Write a story';
            write.addEventListener('click', onWrite);
            head.append(write);
        }
        const date = document.createElement('div');
        date.className = 'nw-date';
        date.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        const wrap = document.createElement('div');
        wrap.className = 'nw-top';
        wrap.append(head, date);
        return wrap;
    }

    function tag(story) {
        const t = document.createElement('div');
        t.className = 'nw-tag' + (story.breaking ? ' breaking' : '');
        t.textContent = story.breaking ? 'Breaking' : story.category;
        return t;
    }

    function byline(story) {
        const b = document.createElement('div');
        b.className = 'nw-by';
        b.textContent = story.author + ' · ' + ui.fmtWhen(story.at);
        return b;
    }

    function leadCard(view, story) {
        const card = document.createElement('div');
        card.className = 'nw-lead' + (story.image ? '' : ' no-image');
        if (story.image) {
            const img = document.createElement('div');
            img.className = 'nw-lead-img';
            img.style.backgroundImage = `url("${String(story.image).replace(/"/g, '%22')}")`;
            card.append(img);
        }
        const body = document.createElement('div');
        body.className = 'nw-lead-body';
        const title = document.createElement('div');
        title.className = 'nw-lead-title';
        title.textContent = story.title;
        const excerpt = document.createElement('div');
        excerpt.className = 'nw-excerpt';
        excerpt.textContent = story.excerpt || '';
        body.append(tag(story), title, excerpt, byline(story));
        card.append(body);
        card.addEventListener('click', () => article(view, story.id));
        return card;
    }

    function storyRow(view, story) {
        const row = document.createElement('div');
        row.className = 'nw-row';
        const text = document.createElement('div');
        text.className = 'nw-row-text';
        const title = document.createElement('div');
        title.className = 'nw-row-title';
        title.textContent = story.title;
        text.append(tag(story), title, byline(story));
        row.append(text);
        if (story.image) {
            const thumb = document.createElement('div');
            thumb.className = 'nw-thumb';
            thumb.style.backgroundImage = `url("${String(story.image).replace(/"/g, '%22')}")`;
            row.append(thumb);
        }
        row.addEventListener('click', () => article(view, story.id));
        return row;
    }

    async function home(view) {
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.classList.add('news-view');
        const skel = ui.skeleton(5, { noAvatar: true });
        view.append(skel);

        const res = await PhoneOS.api('news:list');
        if (!fresh()) return;
        cache = (res && res.ok && res.data) || { stories: [], canWrite: false, categories: [] };
        view.textContent = '';

        const content = ui.content();
        content.classList.add('nw-content');
        content.append(masthead(cache.canWrite, () => compose(view)));

        const chips = document.createElement('div');
        chips.className = 'nw-chips';
        for (const c of ['All', ...cache.categories]) {
            const chip = document.createElement('button');
            chip.className = 'nw-chip' + (category === c ? ' on' : '');
            chip.textContent = c;
            chip.addEventListener('click', () => { category = c; home(view); });
            chips.append(chip);
        }
        content.append(chips);

        const stories = cache.stories.filter((s) => category === 'All' || s.category === category);
        if (!stories.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = cache.canWrite ? 'Nothing published yet. Tap + to write the first story.' : 'No stories yet. Check back soon.';
            content.append(empty);
        } else {
            content.append(leadCard(view, stories[0]));
            if (stories.length > 1) {
                const list = document.createElement('div');
                list.className = 'nw-list';
                for (const s of stories.slice(1)) list.append(storyRow(view, s));
                content.append(list);
            }
        }
        view.append(content);
    }

    async function article(view, id) {
        const fresh = PhoneOS.freshRender(view);
        view.textContent = '';
        view.append(ui.header('', { back: { label: PhoneOS.appName('news'), onTap: () => home(view) } }));
        const content = ui.content();
        content.classList.add('nw-article');
        view.append(content);

        const res = await PhoneOS.api('news:get', { id });
        if (!fresh()) return;
        if (!res || !res.ok) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'This story was taken down.';
            content.append(empty);
            return;
        }
        const s = res.data;
        if (s.image) {
            const img = document.createElement('img');
            img.className = 'nw-hero';
            img.src = s.image;
            content.append(img);
        }
        const title = document.createElement('div');
        title.className = 'nw-a-title';
        title.textContent = s.title;
        const by = document.createElement('div');
        by.className = 'nw-a-by';
        by.textContent = 'By ' + s.author + ' · ' + new Date(s.at).toLocaleString(undefined,
            { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        content.append(tag(s), title, by);

        for (const para of String(s.body).split(/\n{2,}/)) {
            const p = document.createElement('p');
            p.className = 'nw-p';
            p.textContent = para.trim();
            if (p.textContent) content.append(p);
        }

        if (s.canDelete) {
            const del = document.createElement('button');
            del.className = 'nw-takedown';
            del.textContent = 'Take down story';
            del.addEventListener('click', async () => {
                if (!await ui.confirm(view, 'Take this story down? Everyone loses it.', 'Take Down')) return;
                await PhoneOS.api('news:delete', { id: s.id });
                home(view);
            });
            content.append(del);
        }
    }

    function compose(view) {
        view.textContent = '';
        view.append(ui.header('', { back: { label: 'Cancel', onTap: () => home(view) } }));
        const content = ui.content();
        content.append(ui.label('New story'));

        const titleInput = ui.textInput({ placeholder: 'Headline' });
        titleInput.maxLength = 90;
        const bodyInput = document.createElement('textarea');
        bodyInput.className = 'text-input note-body-input';
        bodyInput.style.minHeight = '170px';
        bodyInput.placeholder = 'Write the story. Leave a blank line between paragraphs.';
        bodyInput.maxLength = 4000;

        let pick = (cache && cache.categories[0]) || 'City';
        const chips = document.createElement('div');
        chips.className = 'nw-chips nw-pick';
        const paint = () => [...chips.children].forEach((c) => c.classList.toggle('on', c.textContent === pick));
        for (const c of (cache && cache.categories) || []) {
            const chip = document.createElement('button');
            chip.className = 'nw-chip';
            chip.textContent = c;
            chip.addEventListener('click', () => { pick = c; paint(); });
            chips.append(chip);
        }
        paint();

        const form = document.createElement('div');
        form.className = 'form-fields';
        form.append(titleInput, chips, bodyInput);
        content.append(form);

        let imageUrl = null;
        const attach = document.createElement('button');
        attach.className = 'contact-action';
        attach.textContent = '📷 Add Photo';
        attach.addEventListener('click', async () => {
            const photo = await PhoneOS.pickPhoto();
            if (photo) {
                imageUrl = photo.url;
                attach.textContent = '📷 Photo added';
            }
        });
        content.append(attach);

        let breaking = false;
        content.append(ui.label(''));
        content.append(ui.group([
            ui.row({ text: 'Breaking news', control: ui.toggle(false, (on) => { breaking = on; }) }),
        ]));
        const hint = document.createElement('div');
        hint.className = 'nw-hint';
        hint.textContent = 'Breaking news sends an alert to every phone in the city.';
        content.append(hint);

        const error = document.createElement('div');
        error.className = 'form-error';
        content.append(error);

        const publish = document.createElement('button');
        publish.className = 'primary-btn nw-publish';
        publish.textContent = 'Publish';
        publish.addEventListener('click', async () => {
            error.textContent = '';
            publish.disabled = true;
            const res = await PhoneOS.api('news:post', {
                title: titleInput.value.trim(),
                body: bodyInput.value.trim(),
                category: pick,
                imageUrl,
                breaking,
            });
            publish.disabled = false;
            if (res && res.ok) {
                category = 'All';
                article(view, res.data.id);
                return;
            }
            if (res && res.error === 'breaking_cooldown') {
                error.textContent = 'You can send another breaking alert in ' + Math.ceil((res.wait || 60) / 60) + ' min.';
                return;
            }
            error.textContent = ERRORS[res && res.error] || 'Couldn’t publish the story.';
        });
        content.append(publish);
        view.append(content);
    }

    PhoneOS.registerApp({
        id: 'news', name: 'Weazel News', store: true,
        iconBg: 'linear-gradient(135deg,#ff4b55,#c4121f)',
        glyph: PhoneOS.glyphs.news,
        render: (view) => home(view),
    });
})();
