(() => {
    const ui = PhoneOS.ui;
    const CELLS = 15;

    function bestScore(set) {
        try {
            if (set !== undefined) localStorage.setItem('xsViper', String(set));
            return Number(localStorage.getItem('xsViper')) || 0;
        } catch (e) { return 0; }
    }

    function render(view) {
        view.textContent = '';
        view.append(ui.header('Viper'));

        const content = ui.content();
        const scoreBar = document.createElement('div');
        scoreBar.className = 'g2048-scores';
        const scoreEl = document.createElement('div');
        scoreEl.className = 'g2048-score';
        const bestEl = document.createElement('div');
        bestEl.className = 'g2048-score';
        scoreBar.append(scoreEl, bestEl);

        const frame = document.createElement('div');
        frame.className = 'viper-frame';
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        canvas.tabIndex = 0;
        frame.append(canvas);

        const newBtn = document.createElement('button');
        newBtn.className = 'primary-btn';
        newBtn.textContent = 'New Game';

        content.append(scoreBar, frame, newBtn);
        view.append(content);

        const ctx = canvas.getContext('2d');
        const px = canvas.width / CELLS;
        let snake, dir, nextDir, food, score, timer, dead;

        function reset() {
            clearInterval(timer);
            snake = [[7, 7], [6, 7], [5, 7]];
            dir = [1, 0];
            nextDir = dir;
            score = 0;
            dead = false;
            placeFood();
            timer = setInterval(tick, 150);
            paint();
        }
        newBtn.addEventListener('click', reset);

        function placeFood() {
            do {
                food = [Math.floor(Math.random() * CELLS), Math.floor(Math.random() * CELLS)];
            } while (snake.some(([x, y]) => x === food[0] && y === food[1]));
        }

        function tick() {
            dir = nextDir;
            const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
            const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= CELLS || head[1] >= CELLS;
            const hitSelf = snake.some(([x, y]) => x === head[0] && y === head[1]);
            if (hitWall || hitSelf) {
                dead = true;
                clearInterval(timer);
                if (score > bestScore()) bestScore(score);
                paint();
                return;
            }
            snake.unshift(head);
            if (head[0] === food[0] && head[1] === food[1]) {
                score += 10;
                placeFood();
                if (score % 50 === 0) {
                    clearInterval(timer);
                    timer = setInterval(tick, Math.max(70, 150 - score / 2));
                }
            } else {
                snake.pop();
            }
            paint();
        }

        function paint() {
            const styles = getComputedStyle(document.getElementById('phone-screen'));
            const accent = styles.getPropertyValue('--accent').trim() || '#0a84ff';

            ctx.fillStyle = '#101014';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#ff453a';
            ctx.beginPath();
            ctx.arc((food[0] + 0.5) * px, (food[1] + 0.5) * px, px * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = accent;
            for (const [i, [x, y]] of snake.entries()) {
                ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 1 - i * 0.04);
                ctx.fillRect(x * px + 1, y * px + 1, px - 2, px - 2);
            }
            ctx.globalAlpha = 1;

            scoreEl.textContent = `Score ${score}`;
            bestEl.textContent = `Best ${bestScore()}`;

            if (dead) {
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = '600 22px -apple-system, "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Game over', canvas.width / 2, canvas.height / 2);
            }
        }

        function steer(dx, dy) {
            if (dx === -dir[0] && dy === -dir[1]) return;
            nextDir = [dx, dy];
        }
        canvas.addEventListener('keydown', (e) => {
            const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            if (d) { e.preventDefault(); steer(d[0], d[1]); }
        });
        let start = null;
        canvas.addEventListener('pointerdown', (e) => { start = [e.clientX, e.clientY]; });
        canvas.addEventListener('pointerup', (e) => {
            if (!start) return;
            const dx = e.clientX - start[0];
            const dy = e.clientY - start[1];
            start = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
            if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
            else steer(0, dy > 0 ? 1 : -1);
        });

        const watchdog = new MutationObserver(() => {
            if (!document.body.contains(canvas)) {
                clearInterval(timer);
                watchdog.disconnect();
            }
        });
        watchdog.observe(document.getElementById('app-layer'), { childList: true, subtree: true });

        reset();
        setTimeout(() => canvas.focus(), 300);
    }

    PhoneOS.registerApp({
        id: 'snake', name: 'Viper', store: true,
        iconBg: 'linear-gradient(135deg,#3ddc84,#118a4e)',
        glyph: PhoneOS.glyphs.snake,
        render,
    });
})();
