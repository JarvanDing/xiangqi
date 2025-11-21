// script.js

document.addEventListener('DOMContentLoaded', () => {
    const game = new XiangqiGame();
    game.init();
});

class XiangqiGame {
    constructor() {
        this.board = document.getElementById('chessboard');
        this.piecesLayer = document.querySelector('.pieces-layer');
        this.gridOverlay = document.querySelector('.grid-overlay');
        this.engine = new XiangqiEngine();
        this.selectedPiece = null;
        this.turn = 'red'; // 'red' (红方) 或 'black' (黑方)
        this.gameOver = false;
        this.difficulty = 2; // 默认中等难度
        // 检查是否应该使用揭棋模式（通过检查是否存在 jieqi-engine.js 或 HTML 的 data-mode 属性）
        const htmlMode = document.documentElement.getAttribute('data-mode');
        this.gameMode = htmlMode === 'jieqi' ? 'jieqi' : 'standard';

        // UI 元素
        this.statusEl = document.getElementById('game-status');
        this.turnEl = document.getElementById('turn-indicator');
        this.restartBtn = document.getElementById('restart-btn');
        this.undoBtn = document.getElementById('undo-btn');
        this.resignBtn = document.getElementById('resign-btn');
        this.difficultySelect = document.getElementById('difficulty');
        this.gameModeSelect = document.getElementById('game-mode'); // 可能不存在
        this.capturedRedEl = document.getElementById('captured-red');
        this.capturedBlackEl = document.getElementById('captured-black');

        // 尺寸（必须与 CSS 匹配）
        this.cellSize = 64;
        this.boardPadding = 36;

        this.soundManager = new SoundManager();

        // 战绩统计
        this.winCountEl = document.getElementById('win-count');
        this.lossCountEl = document.getElementById('loss-count');
        this.loadRecord();

        // 移动端优化
        this.updateBoardDimensions();
        window.addEventListener('resize', () => this.updateBoardDimensions());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateBoardDimensions(), 100);
        });
    }

    init() {
        console.log("Game Initializing...");
        
        // 根据游戏模式初始化引擎
        if (this.gameMode === 'jieqi') {
            this.engine = new JieqiEngine();
        } else {
            this.engine = new XiangqiEngine();
        }
        this.engine.setDifficulty(this.difficulty);
        
        this.drawBoardGrid();
        this.bindEvents();

        // 尝试从 localStorage 加载游戏状态
        if (this.loadGameState()) {
            console.log("Game state loaded from localStorage");
        } else {
            this.startNewGame();
        }
    }

    drawBoardGrid() {
        // 使用 SVG 绘制棋盘以获得清晰的线条
        const width = this.cellSize * 8;
        const height = this.cellSize * 9;
        const p = this.boardPadding;

        let svg = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`;

        // 边框
        svg += `<rect x="${p - 4}" y="${p - 4}" width="${width + 8}" height="${height + 8}" fill="none" stroke="#5d4037" stroke-width="4" />`;

        // 水平线
        for (let i = 0; i < 10; i++) {
            const y = p + i * this.cellSize;
            svg += `<line x1="${p}" y1="${y}" x2="${p + width}" y2="${y}" stroke="#5d4037" stroke-width="1.5" />`;
        }

        // 垂直线（被楚河汉界分开）
        for (let i = 0; i < 9; i++) {
            const x = p + i * this.cellSize;
            // 上半部分
            svg += `<line x1="${x}" y1="${p}" x2="${x}" y2="${p + this.cellSize * 4}" stroke="#5d4037" stroke-width="1.5" />`;
            // 下半部分
            svg += `<line x1="${x}" y1="${p + this.cellSize * 5}" x2="${x}" y2="${p + height}" stroke="#5d4037" stroke-width="1.5" />`;
        }

        // 侧边线（连接楚河汉界）
        svg += `<line x1="${p}" y1="${p + this.cellSize * 4}" x2="${p}" y2="${p + this.cellSize * 5}" stroke="#5d4037" stroke-width="1.5" />`;
        svg += `<line x1="${p + width}" y1="${p + this.cellSize * 4}" x2="${p + width}" y2="${p + this.cellSize * 5}" stroke="#5d4037" stroke-width="1.5" />`;

        // 九宫格（X 形状）
        // 上方九宫格
        svg += `<line x1="${p + 3 * this.cellSize}" y1="${p}" x2="${p + 5 * this.cellSize}" y2="${p + 2 * this.cellSize}" stroke="#5d4037" stroke-width="1.5" />`;
        svg += `<line x1="${p + 5 * this.cellSize}" y1="${p}" x2="${p + 3 * this.cellSize}" y2="${p + 2 * this.cellSize}" stroke="#5d4037" stroke-width="1.5" />`;
        // 下方九宫格
        svg += `<line x1="${p + 3 * this.cellSize}" y1="${p + 7 * this.cellSize}" x2="${p + 5 * this.cellSize}" y2="${p + 9 * this.cellSize}" stroke="#5d4037" stroke-width="1.5" />`;
        svg += `<line x1="${p + 5 * this.cellSize}" y1="${p + 7 * this.cellSize}" x2="${p + 3 * this.cellSize}" y2="${p + 9 * this.cellSize}" stroke="#5d4037" stroke-width="1.5" />`;

        // 楚河汉界文字
        svg += `<text x="${p + 2 * this.cellSize}" y="${p + 4.5 * this.cellSize}" dominant-baseline="middle" text-anchor="middle" font-family="KaiTi" font-size="32" fill="#5d4037" style="user-select: none;">楚 河</text>`;
        svg += `<text x="${p + 6 * this.cellSize}" y="${p + 4.5 * this.cellSize}" dominant-baseline="middle" text-anchor="middle" font-family="KaiTi" font-size="32" fill="#5d4037" style="user-select: none;">汉 界</text>`;

        // 炮/卒起始位置的标记（十字）
        const marks = [
            [2, 1], [2, 7], // 上方炮
            [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], // 上方卒
            [7, 1], [7, 7], // 下方炮
            [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]  // 下方兵
        ];

        marks.forEach(([r, c]) => {
            const x = p + c * this.cellSize;
            const y = p + r * this.cellSize;
            const o = 5; // 偏移量
            const l = 10; // 长度

            // 左上角
            if (c > 0) {
                svg += `<path d="M${x - o - l} ${y - o} L${x - o} ${y - o} L${x - o} ${y - o - l}" fill="none" stroke="#5d4037" stroke-width="1.5" />`;
                svg += `<path d="M${x - o - l} ${y + o} L${x - o} ${y + o} L${x - o} ${y + o + l}" fill="none" stroke="#5d4037" stroke-width="1.5" />`;
            }
            // 右上角
            if (c < 8) {
                svg += `<path d="M${x + o} ${y - o - l} L${x + o} ${y - o} L${x + o + l} ${y - o}" fill="none" stroke="#5d4037" stroke-width="1.5" />`;
                svg += `<path d="M${x + o} ${y + o + l} L${x + o} ${y + o} L${x + o + l} ${y + o}" fill="none" stroke="#5d4037" stroke-width="1.5" />`;
            }
        });

        svg += `</svg>`;
        this.gridOverlay.innerHTML = svg;
    }

    bindEvents() {
        this.restartBtn.addEventListener('click', () => this.startNewGame());
        this.undoBtn.addEventListener('click', () => this.undoMove());
        this.resignBtn.addEventListener('click', () => this.resignGame());
        this.difficultySelect.addEventListener('click', (e) => {
            this.difficulty = parseInt(e.target.value);
            this.engine.setDifficulty(this.difficulty);
        });
        
        // 游戏模式选择（如果存在）
        if (this.gameModeSelect) {
            this.gameModeSelect.addEventListener('change', (e) => {
                this.switchGameMode(e.target.value);
            });
        }

        // 棋盘点击和触摸处理
        this.piecesLayer.addEventListener('click', (e) => this.handleBoardClick(e));

        // 添加触摸事件支持
        this.piecesLayer.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 防止默认的滚动行为
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                // 创建一个模拟的鼠标事件
                const mouseEvent = new MouseEvent('click', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true,
                    cancelable: true
                });
                e.target.dispatchEvent(mouseEvent);
            }
        }, { passive: false });

        // 防止双指缩放
        this.piecesLayer.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    switchGameMode(mode) {
        this.gameMode = mode;
        if (mode === 'jieqi') {
            this.engine = new JieqiEngine();
        } else {
            this.engine = new XiangqiEngine();
        }
        this.engine.setDifficulty(this.difficulty);
        this.startNewGame();
    }

    startNewGame() {
        this.engine.reset();
        this.turn = 'red';
        this.gameOver = false;
        this.selectedPiece = null;
        this.updateStatus('游戏开始，红方先行');

        this.renderBoard();
        this.updateCapturedPieces();
        this.saveGameState();
        this.soundManager.playStart();
    }

    renderBoard() {
        this.piecesLayer.innerHTML = ''; // 清除现有棋子
        const state = this.engine.getBoardState();

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = state[r][c];
                if (piece && piece !== '.') {
                    this.createPieceElement(r, c, piece);
                }
            }
        }
        this.updateTurnIndicator();
        this.updateCapturedPieces();

        // 高亮最后一步移动
        const lastMove = this.engine.getLastMove();
        if (lastMove) {
            this.highlightLastMove(lastMove);
        }
    }

    createPieceElement(row, col, pieceCode) {
        const el = document.createElement('div');
        el.className = `piece ${this.getPieceColor(pieceCode)}`;
        el.textContent = this.getPieceChar(pieceCode);
        el.dataset.row = row;
        el.dataset.col = col;
        el.dataset.code = pieceCode;

        // 揭棋模式:检查是否是暗棋
        if (this.gameMode === 'jieqi' && this.engine.isHidden && this.engine.isHidden(row, col)) {
            el.classList.add('hidden');
            el.dataset.hidden = 'true';
        }

        // 位置
        this.updatePiecePosition(el, row, col);

        this.piecesLayer.appendChild(el);
        return el;
    }

    updatePiecePosition(el, row, col) {
        const left = this.boardPadding + col * this.cellSize;
        const top = this.boardPadding + row * this.cellSize;
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    }

    getPieceColor(code) {
        return code === code.toUpperCase() ? 'red' : 'black';
    }

    getPieceChar(code) {
        const map = {
            'R': '车', 'N': '马', 'B': '相', 'A': '仕', 'K': '帅', 'C': '炮', 'P': '兵',
            'r': '车', 'n': '马', 'b': '象', 'a': '士', 'k': '将', 'c': '炮', 'p': '卒'
        };
        return map[code] || '';
    }

    handleBoardClick(e) {
        if (this.gameOver) return;

        const rect = this.board.getBoundingClientRect();
        const x = e.clientX - rect.left - this.boardPadding;
        const y = e.clientY - rect.top - this.boardPadding;

        // 找到最近的网格交叉点
        const col = Math.round(x / this.cellSize);
        const row = Math.round(y / this.cellSize);

        if (col < 0 || col > 8 || row < 0 || row > 9) return;

        this.handleSquareClick(row, col);
    }

    handleSquareClick(row, col) {
        const pieceAtTarget = this.engine.getPieceAt(row, col);
        const isMyPiece = pieceAtTarget && this.getPieceColor(pieceAtTarget) === this.turn;

        if (this.selectedPiece) {
            // 如果点击同一个棋子，取消选中
            if (this.selectedPiece.row === row && this.selectedPiece.col === col) {
                this.deselectPiece();
                return;
            }

            // 如果点击另一个己方棋子，切换选中
            if (isMyPiece) {
                this.selectPiece(row, col);
                return;
            }

            // 尝试移动
            if (this.engine.isValidMove(this.selectedPiece.row, this.selectedPiece.col, row, col)) {
                this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
            } else {
                // 无效移动
                this.soundManager.playInvalid();
                console.log("Invalid move");
            }
        } else {
            // 如果是己方棋子，则选中
            if (isMyPiece) {
                this.selectPiece(row, col);
            }
        }
    }

    selectPiece(row, col) {
        this.deselectPiece(); // 清除之前的选中
        this.selectedPiece = { row, col };

        // 视觉反馈
        const el = document.querySelector(`.piece[data-row='${row}'][data-col='${col}']`);
        if (el) {
            el.classList.add('selected');
            this.soundManager.playSelect();
        }
    }

    deselectPiece() {
        if (this.selectedPiece) {
            const el = document.querySelector(`.piece[data-row='${this.selectedPiece.row}'][data-col='${this.selectedPiece.col}']`);
            if (el) el.classList.remove('selected');
            this.selectedPiece = null;
        }
    }

    highlightLastMove(move) {
        // 移除旧的高亮
        document.querySelectorAll('.last-move-from').forEach(el => el.remove());
        document.querySelectorAll('.last-move').forEach(el => el.classList.remove('last-move'));

        // 高亮“从”位置（阴影）
        const fromEl = document.createElement('div');
        fromEl.className = 'last-move-from';
        this.updatePiecePosition(fromEl, move.fromRow, move.fromCol);
        this.piecesLayer.appendChild(fromEl);

        // 高亮“到”位置（棋子）
        const toEl = document.querySelector(`.piece[data-row='${move.toRow}'][data-col='${move.toCol}']`);
        if (toEl) toEl.classList.add('last-move');
    }

    highlightKingCheck(isRed) {
        const kingChar = isRed ? 'K' : 'k';
        // Note: We need to find the piece element based on code. 
        // Since there's only one King per side, we can search by code.
        // However, renderBoard creates elements with data-code.
        const el = document.querySelector(`.piece[data-code='${kingChar}']`);
        if (el) el.classList.add('check');
    }

    removeCheckHighlight() {
        document.querySelectorAll('.piece.check').forEach(el => el.classList.remove('check'));
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        // 1. Capture Logic for Sound
        const targetPiece = this.engine.getPieceAt(toRow, toCol);
        const isCapture = targetPiece !== null;

        // 2. Engine Move
        this.engine.movePiece(fromRow, fromCol, toRow, toCol);

        // 3. Visual Animation
        const movingPieceEl = document.querySelector(`.piece[data-row='${fromRow}'][data-col='${fromCol}']`);
        const capturedPieceEl = document.querySelector(`.piece[data-row='${toRow}'][data-col='${toCol}']`);

        if (capturedPieceEl) {
            capturedPieceEl.remove();
        }

        if (movingPieceEl) {
            // 揭棋模式:翻开暗棋的视觉动画
            if (this.gameMode === 'jieqi' && movingPieceEl.dataset.hidden === 'true') {
                movingPieceEl.classList.add('flipping');
                setTimeout(() => {
                    movingPieceEl.classList.remove('hidden', 'flipping');
                    movingPieceEl.dataset.hidden = 'false';
                    // 注意：revealPiece已经在引擎的movePiece中调用了
                }, 300);
            }

            this.updatePiecePosition(movingPieceEl, toRow, toCol);
            movingPieceEl.dataset.row = toRow;
            movingPieceEl.dataset.col = toCol;
        } else {
            // Fallback
            this.renderBoard();
        }

        // 4. Sound
        if (isCapture) this.soundManager.playCapture();
        else this.soundManager.playMove();

        // 5. Highlights
        this.deselectPiece();
        this.highlightLastMove({ fromRow, fromCol, toRow, toCol });

        // 6. Game Logic
        const winState = this.engine.checkWin();
        if (winState) {
            this.gameOver = true;
            this.updateStatus(`游戏结束，${winState === 'red' ? '红方' : '黑方'}获胜!`);
            if (winState === 'red') {
                this.soundManager.playWin();
                this.updateRecord(true); // 记录胜利
            } else {
                this.soundManager.playLose();
                this.updateRecord(false); // 记录失败
            }
            this.saveGameState();
            return;
        }

        // Check for "Check"
        const nextTurn = this.turn === 'red' ? 'black' : 'red';
        const isNextInCheck = this.engine.isKingInCheck(nextTurn === 'red');

        this.removeCheckHighlight();
        if (isNextInCheck) {
            this.soundManager.playCheck();
            this.highlightKingCheck(nextTurn === 'red');
        }

        this.turn = nextTurn;
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.saveGameState();

        // 困毙检查（无路可走）
        const legalMoves = this.engine.getAllLegalMoves(this.turn === 'red');
        if (legalMoves.length === 0) {
            this.gameOver = true;
            const winner = this.turn === 'red' ? '黑方' : '红方';
            this.updateStatus(`游戏结束，${this.turn === 'red' ? '红方' : '黑方'}困毙，${winner}获胜!`);
            if (winner === 'red') {
                this.soundManager.playWin();
                this.updateRecord(true); // 记录胜利
            } else {
                this.soundManager.playLose();
                this.updateRecord(false); // 记录失败
            }
            this.saveGameState();
            return;
        }

        // AI Move
        if (this.turn === 'black' && !this.gameOver) {
            this.updateStatus('AI 思考中...');
            // 动态延迟：简单难度快，困难难度慢
            const delay = this.difficulty === 1 ? 200 : (this.difficulty === 2 ? 350 : 500);
            setTimeout(() => {
                this.makeAIMove();
            }, delay);
        } else {
            if (isNextInCheck) this.updateStatus('将军！轮到红方走棋');
            else this.updateStatus('轮到红方走棋');
        }
    }

    makeAIMove() {
        const move = this.engine.getBestMove();
        if (move) {
            this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        } else {
            // AI 困毙检查？
            // 如果 AI 无路可走，则判负。
            this.gameOver = true;
            this.updateStatus('游戏结束，红方获胜! (AI困毙)');
            this.saveGameState();
        }
    }

    undoMove() {
        // 撤销 AI 移动
        if (this.turn === 'red' && this.engine.history.length > 0) {
            if (this.engine.undo()) {
                this.turn = 'black';
            }
        }

        // 撤销玩家移动
        if (this.turn === 'black' && this.engine.history.length > 0) {
            if (this.engine.undo()) {
                this.turn = 'red';
            }
        }

        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.gameOver = false;
        this.updateStatus('悔棋成功');
        this.saveGameState();
        this.soundManager.playUndo();

        // 清除移动痕迹
        document.querySelectorAll('.last-move-from').forEach(el => el.remove());

        // 恢复将军高亮
        const isCheck = this.engine.isKingInCheck(this.turn === 'red');
        if (isCheck) {
            this.highlightKingCheck(this.turn === 'red');
        }
    }

    updateStatus(msg) {
        this.statusEl.textContent = msg;
    }

    updateTurnIndicator() {
        this.turnEl.textContent = this.turn === 'red' ? '红方' : '黑方';
        this.turnEl.className = this.turn === 'red' ? 'turn-red' : 'turn-black';
    }

    updateCapturedPieces() {
        // 更新被红方吃掉的棋子（黑方棋子，显示在下方）
        this.capturedRedEl.innerHTML = '';
        if (this.engine.capturedRed) {
            this.engine.capturedRed.forEach((pieceCode, index) => {
                const el = document.createElement('div');
                el.className = `captured-piece red`;
                
                // 如果是揭棋模式，检查是否是暗棋
                if (this.gameMode === 'jieqi' && this.engine.capturedHiddenPieces) {
                    const hiddenKey = `red-${index}`;
                    if (this.engine.capturedHiddenPieces.includes(hiddenKey)) {
                        // 暗棋保持背面朝上（CSS的::after会显示问号）
                        el.classList.add('hidden');
                        el.textContent = ''; // 清空文本，让CSS显示问号
                    } else {
                        el.textContent = this.getPieceChar(pieceCode);
                    }
                } else {
                    el.textContent = this.getPieceChar(pieceCode);
                }
                
                this.capturedRedEl.appendChild(el);
            });
        }

        // 更新被黑方吃掉的棋子（红方棋子，显示在上方）
        this.capturedBlackEl.innerHTML = '';
        if (this.engine.capturedBlack) {
            this.engine.capturedBlack.forEach((pieceCode, index) => {
                const el = document.createElement('div');
                el.className = `captured-piece black`;
                
                // 如果是揭棋模式，检查是否是暗棋
                if (this.gameMode === 'jieqi' && this.engine.capturedHiddenPieces) {
                    const hiddenKey = `black-${index}`;
                    if (this.engine.capturedHiddenPieces.includes(hiddenKey)) {
                        // 暗棋保持背面朝上（CSS的::after会显示问号）
                        el.classList.add('hidden');
                        el.textContent = ''; // 清空文本，让CSS显示问号
                    } else {
                        el.textContent = this.getPieceChar(pieceCode);
                    }
                } else {
                    el.textContent = this.getPieceChar(pieceCode);
                }
                
                this.capturedBlackEl.appendChild(el);
            });
        }
    }

    resignGame() {
        if (this.gameOver) {
            this.updateStatus('游戏已结束');
            return;
        }

        // 确认认输
        if (confirm('确定要认输吗?')) {
            this.gameOver = true;
            this.updateStatus('游戏结束，红方认输，黑方获胜!');
            this.soundManager.playLose();
            this.updateRecord(false); // 记录失败
            this.saveGameState();
        }
    }

    loadRecord() {
        try {
            const record = localStorage.getItem('xiangqi_record');
            if (record) {
                const { wins, losses } = JSON.parse(record);
                this.winCountEl.textContent = wins || 0;
                this.lossCountEl.textContent = losses || 0;
            } else {
                this.winCountEl.textContent = 0;
                this.lossCountEl.textContent = 0;
            }
        } catch (e) {
            console.error('加载战绩失败:', e);
            this.winCountEl.textContent = 0;
            this.lossCountEl.textContent = 0;
        }
    }

    saveRecord(wins, losses) {
        try {
            localStorage.setItem('xiangqi_record', JSON.stringify({ wins, losses }));
        } catch (e) {
            console.error('保存战绩失败:', e);
        }
    }

    updateRecord(isWin) {
        const currentWins = parseInt(this.winCountEl.textContent) || 0;
        const currentLosses = parseInt(this.lossCountEl.textContent) || 0;

        if (isWin) {
            this.winCountEl.textContent = currentWins + 1;
            this.saveRecord(currentWins + 1, currentLosses);
        } else {
            this.lossCountEl.textContent = currentLosses + 1;
            this.saveRecord(currentWins, currentLosses + 1);
        }
    }

    saveGameState() {
        try {
            const gameState = {
                board: this.engine.getBoardState(),
                history: this.engine.history,
                turn: this.turn,
                gameOver: this.gameOver,
                difficulty: this.difficulty,
                gameMode: this.gameMode,
                capturedRed: this.engine.capturedRed || [],
                capturedBlack: this.engine.capturedBlack || [],
                timestamp: Date.now()
            };
            
            // 如果是揭棋模式，保存暗棋信息
            if (this.gameMode === 'jieqi' && this.engine.hiddenPieces && this.engine.originalPositions) {
                gameState.hiddenPieces = this.engine.hiddenPieces;
                gameState.originalPositions = this.engine.originalPositions;
                gameState.capturedHiddenPieces = this.engine.capturedHiddenPieces || [];
            }
            
            // 使用不同的 key 区分传统象棋和揭棋
            const storageKey = this.gameMode === 'jieqi' ? 'jieqi_game_state' : 'xiangqi_game_state';
            localStorage.setItem(storageKey, JSON.stringify(gameState));
        } catch (e) {
            console.error('保存游戏状态失败:', e);
        }
    }

    loadGameState() {
        try {
            // 使用不同的 key 区分传统象棋和揭棋
            const storageKey = this.gameMode === 'jieqi' ? 'jieqi_game_state' : 'xiangqi_game_state';
            const savedState = localStorage.getItem(storageKey);
            if (!savedState) return false;

            const gameState = JSON.parse(savedState);

            // 检查保存的状态是否有效，并且游戏模式匹配
            if (!gameState.board || !gameState.turn) return false;
            if (gameState.gameMode && gameState.gameMode !== this.gameMode) return false;

            // 恢复游戏状态
            this.engine.board = gameState.board.map(row => [...row]);
            this.engine.history = gameState.history || [];
            this.engine.capturedRed = gameState.capturedRed || [];
            this.engine.capturedBlack = gameState.capturedBlack || [];
            
            // 如果是揭棋模式，恢复暗棋信息
            if (this.gameMode === 'jieqi' && this.engine.hiddenPieces !== undefined) {
                this.engine.hiddenPieces = gameState.hiddenPieces || [];
                this.engine.originalPositions = gameState.originalPositions || [];
                this.engine.capturedHiddenPieces = gameState.capturedHiddenPieces || [];
            }
            
            this.turn = gameState.turn;
            this.gameOver = gameState.gameOver || false;
            this.difficulty = gameState.difficulty || 2;

            // 更新 UI
            this.difficultySelect.value = this.difficulty;
            this.engine.setDifficulty(this.difficulty);
            this.renderBoard();

            if (this.gameOver) {
                this.updateStatus('游戏已结束(已从上次保存恢复)');
            } else {
                this.updateStatus(`游戏已恢复，轮到${this.turn === 'red' ? '红方' : '黑方'}走棋`);
            }

            return true;
        } catch (e) {
            console.error('加载游戏状态失败:', e);
            return false;
        }
    }

    // 移动端优化：更新棋盘尺寸
    updateBoardDimensions() {
        // 获取CSS变量的值（根据屏幕尺寸动态调整）
        const computedStyle = getComputedStyle(document.documentElement);
        this.cellSize = parseInt(computedStyle.getPropertyValue('--cell-size')) || 64;
        this.boardPadding = parseInt(computedStyle.getPropertyValue('--board-padding')) || 36;

        // 重新绘制棋盘网格以适应新尺寸
        if (this.board && this.gridOverlay) {
            this.drawBoardGrid();
        }

        // 重新渲染所有棋子以适应新尺寸
        if (this.piecesLayer) {
            this.renderBoard();
        }
    }
}

class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playTone(freq, type, duration) {
        if (!this.enabled) return;
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playMove() { this.playTone(200, 'sine', 0.1); }
    playCapture() { this.playTone(150, 'sawtooth', 0.15); }
    playCheck() { this.playTone(600, 'sine', 0.3); }
    playSelect() { this.playTone(300, 'sine', 0.05); }
    playInvalid() { this.playTone(100, 'sawtooth', 0.1); }
    playUndo() { this.playTone(250, 'triangle', 0.1); }
    playStart() {
        if (!this.enabled) return;
        if (!this.ctx) this.init();
        [262, 330, 392].forEach((f, i) => setTimeout(() => this.playTone(f, 'sine', 0.15), i * 80));
    }
    playWin() {
        if (!this.enabled) return;
        if (!this.ctx) this.init();
        [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.playTone(f, 'sine', 0.2), i * 100));
    }
    playLose() {
        if (!this.enabled) return;
        if (!this.ctx) this.init();
        [400, 350, 300, 250].forEach((f, i) => setTimeout(() => this.playTone(f, 'sine', 0.15), i * 100));
    }
}
