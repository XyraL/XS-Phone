(() => {
    const ui = PhoneOS.ui;

    async function loadNotes() {
        const res = await PhoneOS.api('notes:list');
        return (res && res.ok && res.data) || [];
    }

    async function render(view) {
        view.textContent = '';
        view.append(ui.header('Notes', {
            action: { label: '+', onTap: () => editor(view, null) },
        }));

        const content = ui.content();
        const notes = await loadNotes();

        if (!notes.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No notes yet. Tap + to write one.';
            content.append(empty);
        } else {
            content.append(ui.group(notes.map((n) => {
                const r = document.createElement('div');
                r.className = 'note-row';
                const title = document.createElement('div');
                title.className = 'note-title';
                title.textContent = n.title;
                const meta = document.createElement('div');
                meta.className = 'note-meta';
                meta.textContent = `${ui.fmtWhen(n.at)} · ${(n.body || '').slice(0, 60) || 'No text'}`;
                r.append(title, meta);
                r.addEventListener('click', () => editor(view, n));
                return r;
            })));
        }
        view.append(content);
    }

    function editor(view, note) {
        view.textContent = '';
        view.append(ui.header('', {
            back: { label: 'Notes', onTap: () => render(view) },
            action: note ? { label: 'Delete', onTap: async () => {
                if (await ui.confirm(view, `Delete "${note.title}"?`, 'Delete')) {
                    await PhoneOS.api('notes:delete', { id: note.id });
                    render(view);
                }
            } } : undefined,
        }));

        const content = ui.content();
        const titleInput = ui.textInput({ placeholder: 'Title', value: note && note.title });
        titleInput.classList.add('note-title-input');

        const bodyInput = document.createElement('textarea');
        bodyInput.className = 'text-input note-body-input';
        bodyInput.placeholder = 'Start writing…';
        bodyInput.value = (note && note.body) || '';
        bodyInput.setAttribute('spellcheck', 'false');

        const save = document.createElement('button');
        save.className = 'primary-btn';
        save.textContent = 'Save';
        save.addEventListener('click', async () => {
            const res = await PhoneOS.api('notes:save', {
                id: note && note.id,
                title: titleInput.value.trim(),
                body: bodyInput.value,
            });
            if (res && res.ok) render(view);
            else PhoneOS.notify({ app: 'notes', title: 'Notes', body: 'Couldn\'t save the note.' });
        });

        content.append(titleInput, bodyInput, save);
        view.append(content);
        titleInput.focus();
    }

    PhoneOS.registerApp({
        id: 'notes', name: 'Notes',
        iconBg: 'linear-gradient(135deg,#ffd960,#f0b429)',
        glyph: PhoneOS.glyphs.notes,
        render,
    });
})();
