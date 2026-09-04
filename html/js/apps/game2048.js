(() => {
    const ui = PhoneOS.ui;
    const SIZE = 4;

    function bestScore(set) {
        try {
            if (set !== undefined) localStorage.setItem('cipher2048', String(set));
            return Number(localStorage.getItem('cipher2048')) || 0;
        } catch (e) { return 0; }
    }

    function render(view) {
        view.textContent = '';
        view.append(ui.header('2048'));

        const content = ui.content();
        let grid, score, over;

        const scoreBar = document.createElement('div');
        scoreBar.className = 'g2048-scores';
        const scoreEl = document.createElement('div');
        scoreEl.className = 'g2048-score';
        const bestEl = document.createElement('div');
        bestEl.className = 'g2048-score';
        scoreBar.append(scoreEl, bestEl);

        const board = document.createElement('div');
        board.className = 'g2048-board';
        board.tabIndex = 0;

        const newBtn = document.createElement('button');
        newBtn.className = 'primary-btn';
        newBtn.textContent = 'New Game';
        newBtn.addEventListener('click', reset);

        content.append(scoreBar, board, newBtn);
        view.append(content);

        function reset() {
            grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
            score = 0;
            over = false;
            spawn(); spawn();
            paint();
        }

        function spawn() {
            const empty = [];
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    if (!grid[r][c]) empty.push([r, c]);
                }
            }
            if (!empty.length) return;
            const [r, c] = empty[Math.floor(Math.random() * empty.length)];
            grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }

        function slideRow(row) {
            const vals = row.filter(Boolean);
            for (let i = 0; i < vals.length - 1; i++) {
                if (vals[i] === vals[i + 1]) {
                    vals[i] *= 2;
                    score += vals[i];
                    vals.splice(i + 1, 1);
                }
            }
            while (vals.length < SIZE) vals.push(0);
            return vals;
        }

        function move(dir) {
            if (over) return;
            const before = JSON.stringify(grid);
            const rotate = (g) => g[0].map((_, c) => g.map((row) => row[c]).reverse());
            let g = grid.map((r) => [...r]);
            const turns = { left: 0, up: 3, right: 2, down: 1 }[dir];
            for (let i = 0; i < turns; i++) g = rotate(g);
            g = g.map(slideRow);
            for (let i = 0; i < (4 - turns) % 4; i++) g = rotate(g);
            grid = g;

            if (JSON.stringify(grid) !== before) {
                spawn();
                if (score > bestScore()) bestScore(score);
                if (isStuck()) over = true;
                paint();
            }
        }

        function isStuck() {
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    if (!grid[r][c]) return false;
                    if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false;
                    if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false;
                }
            }
            return true;
        }

        function paint() {
            scoreEl.textContent = `Score ${score}`;
            bestEl.textContent = `Best ${bestScore()}`;
            board.textContent = '';
            for (const row of grid) {
                for (const v of row) {
                    const tile = document.createElement('div');
                    tile.className = 'g2048-tile' + (v ? ` t${Math.min(v, 2048)}` : '');
                    tile.textContent = v || '';
                    board.append(tile);
                }
            }
            if (over) {
                const dead = document.createElement('div');
                dead.className = 'g2048-over';
                dead.textContent = 'Game over';
                board.append(dead);
            }
        }

        board.addEventListener('keydown', (e) => {
            const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
            if (dir) { e.preventDefault(); move(dir); }
        });
        let start = null;
        board.addEventListener('pointerdown', (e) => { start = [e.clientX, e.clientY]; });
        board.addEventListener('pointerup', (e) => {
            if (!start) return;
            const dx = e.clientX - start[0];
            const dy = e.clientY - start[1];
            start = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            move(Math.abs(dx) > Math.abs(dy)
                ? (dx > 0 ? 'right' : 'left')
                : (dy > 0 ? 'down' : 'up'));
        });

        reset();
        setTimeout(() => board.focus(), 300);
    }

    PhoneOS.registerApp({
        id: 'game2048', name: '2048', store: true,
        iconBg: 'linear-gradient(135deg,#f6d365,#e8a33d)',
        glyph: PhoneOS.glyphs.game2048,
        render,
    });
})();
