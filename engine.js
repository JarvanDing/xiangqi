// engine.js

const XIANGQI_BOOK = {
    "rnbakabnr.........c.....c.p.p.p.p.p.....................................P.P.P.P.P.C.....C.........RNBAKABNR": [
        { fromRow: 7, fromCol: 1, toRow: 7, toCol: 4 }, // 炮二平五
        { fromRow: 7, fromCol: 7, toRow: 7, toCol: 4 }, // 炮八平五
        { fromRow: 9, fromCol: 1, toRow: 7, toCol: 2 }, // 马二进三
        { fromRow: 9, fromCol: 7, toRow: 7, toCol: 6 }, // 马八进七
        { fromRow: 6, fromCol: 2, toRow: 5, toCol: 2 }, // 兵三进一
        { fromRow: 6, fromCol: 6, toRow: 5, toCol: 6 }  // 兵七进一
    ]
};


class XiangqiEngine {
    constructor() {
        this.board = [];
        this.history = [];
        this.difficulty = 2;
        this.capturedRed = []; // 被吃掉的红方棋子
        this.capturedBlack = []; // 被吃掉的黑方棋子
        this.PIECE_VALUES = {
            'k': 10000, 'r': 900, 'n': 450, 'c': 450, 'b': 200, 'a': 200, 'p': 100,
            'K': 10000, 'R': 900, 'N': 450, 'C': 450, 'B': 200, 'A': 200, 'P': 100
        };
        this.tt = new Map(); // 置换表
        this.historyTable = new Int32Array(90 * 90); // 历史启发表
        this.reset();
    }

    reset() {
        // 初始化棋盘为标准起始位置
        // 大写：红方，小写：黑方
        // R: 车, N: 马, B: 象, A: 士, K: 帅/将, C: 炮, P: 兵/卒
        const initBoard = [
            ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'], // 0: 黑方底线
            ['.', '.', '.', '.', '.', '.', '.', '.', '.'], // 1
            ['.', 'c', '.', '.', '.', '.', '.', 'c', '.'], // 2: 黑方炮
            ['p', '.', 'p', '.', 'p', '.', 'p', '.', 'p'], // 3: 黑方卒
            ['.', '.', '.', '.', '.', '.', '.', '.', '.'], // 4: 河界
            ['.', '.', '.', '.', '.', '.', '.', '.', '.'], // 5: 河界
            ['P', '.', 'P', '.', 'P', '.', 'P', '.', 'P'], // 6: 红方兵
            ['.', 'C', '.', '.', '.', '.', '.', 'C', '.'], // 7: 红方炮
            ['.', '.', '.', '.', '.', '.', '.', '.', '.'], // 8
            ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R']  // 9: 红方底线
        ];

        // 深拷贝
        this.board = initBoard.map(row => [...row]);
        this.history = [];
        this.capturedRed = [];
        this.capturedBlack = [];
        if (this.tt) this.tt.clear();
        if (this.historyTable) this.historyTable.fill(0);
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    getBoardState() {
        return this.board;
    }

    getPieceAt(row, col) {
        if (row < 0 || row > 9 || col < 0 || col > 8) return null;
        const p = this.board[row][col];
        return p === '.' ? null : p;
    }

    movePiece(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];

        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = '.';

        // 如果吃掉了棋子，记录到对应的数组中
        if (captured && captured !== '.') {
            if (captured === captured.toUpperCase()) {
                // 红方棋子被吃掉
                this.capturedRed.push(captured);
            } else {
                // 黑方棋子被吃掉
                this.capturedBlack.push(captured);
            }
        }

        const key = this.getBoardKey();
        this.history.push({ fromRow, fromCol, toRow, toCol, piece, captured, key });
    }

    undo() {
        const move = this.history.pop();
        if (!move) return null;
        this.board[move.fromRow][move.fromCol] = move.piece;
        this.board[move.toRow][move.toCol] = move.captured;

        // 如果之前有吃子，恢复被吃掉的棋子
        if (move.captured && move.captured !== '.') {
            if (move.captured === move.captured.toUpperCase()) {
                // 恢复红方棋子
                this.capturedRed.pop();
            } else {
                // 恢复黑方棋子
                this.capturedBlack.pop();
            }
        }

        return move;
    }

    getBoardKey() {
        // 简单的字符串表示。对于 90 个格子，这足够快了。
        return this.board.map(r => r.join('')).join('');
    }

    willCauseRepetition() {
        // 棋盘当前处于模拟移动*之后*的状态。
        const currentKey = this.getBoardKey();
        let count = 1; // 它现在存在

        // 检查历史记录中是否有相同的键
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].key === currentKey) {
                count++;
            }
            if (count >= 3) return true;
        }
        return false;
    }

    getLastMove() {
        if (this.history.length > 0) {
            return this.history[this.history.length - 1];
        }
        return null;
    }

    // 检查移动是否有效且不导致被将军
    isValidMove(fromRow, fromCol, toRow, toCol) {
        // 1. 基本几何验证
        if (!this.isGeometricallyValid(fromRow, fromCol, toRow, toCol)) return false;

        // 2. 模拟移动以检查“飞将”和“自杀”
        const originalTarget = this.board[toRow][toCol];
        const movingPiece = this.board[fromRow][fromCol];

        this.board[toRow][toCol] = movingPiece;
        this.board[fromRow][fromCol] = '.';

        let valid = true;

        // 检查飞将
        if (this.isKingsFacing()) {
            valid = false;
        }
        // 检查己方老将是否受攻击（自杀）
        else if (this.isKingInCheck(movingPiece === movingPiece.toUpperCase())) {
            valid = false;
        }
        // 检查重复局面（简单的 3 次重复规则）
        else if (this.willCauseRepetition()) {
            valid = false;
        }

        // 撤销移动
        this.board[fromRow][fromCol] = movingPiece;
        this.board[toRow][toCol] = originalTarget;

        return valid;
    }

    isGeometricallyValid(fromRow, fromCol, toRow, toCol) {
        if (fromRow === toRow && fromCol === toCol) return false;
        if (toRow < 0 || toRow > 9 || toCol < 0 || toCol > 8) return false;

        const piece = this.getPieceAt(fromRow, fromCol);
        if (!piece) return false;

        const target = this.getPieceAt(toRow, toCol);

        // 不能吃己方棋子
        if (target) {
            const isRed = piece === piece.toUpperCase();
            const isTargetRed = target === target.toUpperCase();
            if (isRed === isTargetRed) return false;
        }

        const type = piece.toLowerCase();
        const isRed = piece === piece.toUpperCase();

        switch (type) {
            case 'r': return this.isValidRookMove(fromRow, fromCol, toRow, toCol);
            case 'n': return this.isValidHorseMove(fromRow, fromCol, toRow, toCol);
            case 'b': return this.isValidElephantMove(fromRow, fromCol, toRow, toCol, isRed);
            case 'a': return this.isValidAdvisorMove(fromRow, fromCol, toRow, toCol, isRed);
            case 'k': return this.isValidKingMove(fromRow, fromCol, toRow, toCol, isRed);
            case 'c': return this.isValidCannonMove(fromRow, fromCol, toRow, toCol);
            case 'p': return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, isRed);
            default: return false;
        }
    }

    isValidRookMove(r1, c1, r2, c2) {
        if (r1 !== r2 && c1 !== c2) return false;
        return this.countObstacles(r1, c1, r2, c2) === 0;
    }

    isValidHorseMove(r1, c1, r2, c2) {
        const dr = Math.abs(r2 - r1);
        const dc = Math.abs(c2 - c1);
        if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) return false;

        // 检查蹩马腿
        if (dr === 2) {
            // 垂直移动，检查垂直中间点
            const midR = (r1 + r2) / 2;
            if (this.getPieceAt(midR, c1)) return false;
        } else {
            // 水平移动，检查水平中间点
            const midC = (c1 + c2) / 2;
            if (this.getPieceAt(r1, midC)) return false;
        }
        return true;
    }

    isValidElephantMove(r1, c1, r2, c2, isRed) {
        if (Math.abs(r2 - r1) !== 2 || Math.abs(c2 - c1) !== 2) return false;

        // 不能过河
        if (isRed && r2 < 5) return false; // 红方在下方 (5-9)
        if (!isRed && r2 > 4) return false; // 黑方在上方 (0-4)

        // 检查塞象眼
        const midR = (r1 + r2) / 2;
        const midC = (c1 + c2) / 2;
        if (this.getPieceAt(midR, midC)) return false;

        return true;
    }

    isValidAdvisorMove(r1, c1, r2, c2, isRed) {
        if (Math.abs(r2 - r1) !== 1 || Math.abs(c2 - c1) !== 1) return false;

        // 限制在九宫格内
        if (c2 < 3 || c2 > 5) return false;
        if (isRed) {
            if (r2 < 7 || r2 > 9) return false;
        } else {
            if (r2 < 0 || r2 > 2) return false;
        }
        return true;
    }

    isValidKingMove(r1, c1, r2, c2, isRed) {
        const dr = Math.abs(r2 - r1);
        const dc = Math.abs(c2 - c1);
        if (dr + dc !== 1) return false; // 正交移动 1 步

        // 限制在九宫格内
        if (c2 < 3 || c2 > 5) return false;
        if (isRed) {
            if (r2 < 7 || r2 > 9) return false;
        } else {
            if (r2 < 0 || r2 > 2) return false;
        }
        return true;
    }

    isValidCannonMove(r1, c1, r2, c2) {
        if (r1 !== r2 && c1 !== c2) return false;

        const obstacles = this.countObstacles(r1, c1, r2, c2);
        const target = this.getPieceAt(r2, c2);

        if (!target) {
            // 不吃子移动：必须有 0 个障碍
            return obstacles === 0;
        } else {
            // 吃子：必须正好有 1 个障碍（炮架）
            return obstacles === 1;
        }
    }

    isValidPawnMove(r1, c1, r2, c2, isRed) {
        const dr = r2 - r1;
        const dc = Math.abs(c2 - c1);

        if (isRed) {
            // 红方向上移动 (-1)
            if (r2 > r1) return false; // 不能后退

            if (r1 >= 5) { // 过河前
                if (dr !== -1 || dc !== 0) return false;
            } else { // 过河后
                if ((dr === -1 && dc === 0) || (dr === 0 && dc === 1)) return true;
                else return false;
            }
        } else {
            // 黑方下移动 (+1)
            if (r2 < r1) return false; // 不能后退

            if (r1 <= 4) { // 过河前
                if (dr !== 1 || dc !== 0) return false;
            } else { // 过河后
                if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) return true;
                else return false;
            }
        }
        return true;
    }

    countObstacles(r1, c1, r2, c2) {
        let count = 0;
        if (r1 === r2) {
            const minC = Math.min(c1, c2);
            const maxC = Math.max(c1, c2);
            for (let c = minC + 1; c < maxC; c++) {
                if (this.getPieceAt(r1, c)) count++;
            }
        } else {
            const minR = Math.min(r1, r2);
            const maxR = Math.max(r1, r2);
            for (let r = minR + 1; r < maxR; r++) {
                if (this.getPieceAt(r, c1)) count++;
            }
        }
        return count;
    }

    isKingsFacing() {
        let redKingPos = null;
        let blackKingPos = null;

        // 寻找老将
        for (let r = 0; r < 10; r++) {
            for (let c = 3; c <= 5; c++) {
                if (this.board[r][c] === 'K') redKingPos = { r, c };
                if (this.board[r][c] === 'k') blackKingPos = { r, c };
            }
        }

        if (!redKingPos || !blackKingPos) return false; // Should not happen
        if (redKingPos.c !== blackKingPos.c) return false;

        // 检查中间是否有棋子
        for (let r = blackKingPos.r + 1; r < redKingPos.r; r++) {
            if (this.board[r][redKingPos.c] !== '.') return false;
        }
        return true;
    }

    isKingInCheck(isRed) {
        // 寻找老将
        let kingPos = null;
        const kingChar = isRed ? 'K' : 'k';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] === kingChar) {
                    kingPos = { r, c };
                    break;
                }
            }
            if (kingPos) break;
        }
        if (!kingPos) return true; // 老将被吃？

        // 检查是否有敌方棋子可以移动到老将位置
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p && p !== '.') {
                    const isPieceRed = p === p.toUpperCase();
                    if (isPieceRed !== isRed) {
                        // 敌方棋子
                        if (this.isGeometricallyValid(r, c, kingPos.r, kingPos.c)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    getAllLegalMoves(isRed) {
        const moves = [];
        // 优化：只遍历有棋子的位置，而不是所有90个格子
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p && p !== '.') {
                    const isPieceRed = p === p.toUpperCase();
                    if (isPieceRed === isRed) {
                        // 优化：根据棋子类型生成可能的移动，而不是遍历所有90个目标位置
                        const type = p.toLowerCase();
                        const possibleTargets = this.generatePossibleTargets(r, c, type, isRed);
                        for (const target of possibleTargets) {
                            if (this.isValidMove(r, c, target.r, target.c)) {
                                moves.push({ fromRow: r, fromCol: c, toRow: target.r, toCol: target.c });
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    // 根据棋子类型生成可能的目标位置（减少无效检查）
    generatePossibleTargets(r, c, type, isRed) {
        const targets = [];
        const typeMap = {
            'r': () => {
                // 车：直线移动
                for (let tr = 0; tr < 10; tr++) if (tr !== r) targets.push({ r: tr, c });
                for (let tc = 0; tc < 9; tc++) if (tc !== c) targets.push({ r, c: tc });
            },
            'n': () => {
                // 马：8个可能位置
                const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
                offsets.forEach(([dr, dc]) => {
                    const tr = r + dr, tc = c + dc;
                    if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) targets.push({ r: tr, c: tc });
                });
            },
            'b': () => {
                // 象：4个可能位置
                const offsets = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
                offsets.forEach(([dr, dc]) => {
                    const tr = r + dr, tc = c + dc;
                    if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) targets.push({ r: tr, c: tc });
                });
            },
            'a': () => {
                // 士：4个可能位置
                const offsets = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                offsets.forEach(([dr, dc]) => {
                    const tr = r + dr, tc = c + dc;
                    if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) targets.push({ r: tr, c: tc });
                });
            },
            'k': () => {
                // 将/帅：4个可能位置
                const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                offsets.forEach(([dr, dc]) => {
                    const tr = r + dr, tc = c + dc;
                    if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) targets.push({ r: tr, c: tc });
                });
            },
            'c': () => {
                // 炮：直线移动
                for (let tr = 0; tr < 10; tr++) if (tr !== r) targets.push({ r: tr, c });
                for (let tc = 0; tc < 9; tc++) if (tc !== c) targets.push({ r, c: tc });
            },
            'p': () => {
                // 兵/卒：根据位置和是否过河
                if (isRed) {
                    if (r >= 5) targets.push({ r: r - 1, c }); // 过河前只能向前
                    else {
                        targets.push({ r: r - 1, c }); // 向前
                        if (c > 0) targets.push({ r, c: c - 1 }); // 向左
                        if (c < 8) targets.push({ r, c: c + 1 }); // 向右
                    }
                } else {
                    if (r <= 4) targets.push({ r: r + 1, c }); // 过河前只能向前
                    else {
                        targets.push({ r: r + 1, c }); // 向前
                        if (c > 0) targets.push({ r, c: c - 1 }); // 向左
                        if (c < 8) targets.push({ r, c: c + 1 }); // 向右
                    }
                }
            }
        };

        const generator = typeMap[type];
        if (generator) generator();
        return targets;
    }

    // 棋子位置价值表 (PST)
    getPST(piece, r, c) {
        const isRed = piece === piece.toUpperCase();
        const type = piece.toLowerCase();

        const pst = {
            'p': [ // 兵/卒
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [30, 40, 50, 60, 70, 60, 50, 40, 30],
                [20, 30, 40, 50, 60, 50, 40, 30, 20],
                [20, 20, 20, 20, 20, 20, 20, 20, 20],
                [10, 10, 20, 30, 40, 30, 20, 10, 10],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0]
            ],
            'c': [ // 炮
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [10, 10, 10, 10, 10, 10, 10, 10, 10],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0]
            ],
            'r': [ // 车
                [10, 10, 10, 10, 10, 10, 10, 10, 10],
                [10, 20, 20, 20, 20, 20, 20, 20, 10],
                [5, 10, 10, 10, 10, 10, 10, 10, 5],
                [5, 10, 10, 10, 10, 10, 10, 10, 5],
                [5, 10, 10, 10, 10, 10, 10, 10, 5],
                [5, 10, 10, 10, 10, 10, 10, 10, 5],
                [0, 5, 5, 5, 5, 5, 5, 5, 0],
                [0, 5, 5, 5, 5, 5, 5, 5, 0],
                [0, 5, 5, 5, 5, 5, 5, 5, 0],
                [-5, 5, 5, 5, 5, 5, 5, 5, -5]
            ],
            'n': [ // 马
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [5, 15, 15, 15, 15, 15, 15, 15, 5],
                [5, 10, 20, 20, 20, 20, 20, 10, 5],
                [5, 5, 15, 20, 20, 20, 15, 5, 5],
                [5, 5, 10, 15, 15, 15, 10, 5, 5],
                [5, 5, 10, 15, 15, 15, 10, 5, 5],
                [0, 5, 5, 5, 5, 5, 5, 5, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0]
            ]
        };

        const table = pst[type];
        if (!table) return 0;

        const tableIndex = isRed ? r : 9 - r;
        return table[tableIndex][c] || 0;
    }

    getPieceValue(piece) {
        return this.PIECE_VALUES[piece] || 0;
    }

    evaluate() {
        let score = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p !== '.') {
                    const val = this.getPieceValue(p);
                    const pstVal = this.getPST(p, r, c);

                    if (p === p.toUpperCase()) {
                        score += (val + pstVal);
                    } else {
                        score -= (val + pstVal);
                    }
                }
            }
        }
        return score;
    }

    getHistoryScore(fromR, fromC, toR, toC) {
        const from = fromR * 9 + fromC;
        const to = toR * 9 + toC;
        return this.historyTable[from * 90 + to];
    }

    updateHistoryScore(fromR, fromC, toR, toC, depth) {
        const from = fromR * 9 + fromC;
        const to = toR * 9 + toC;
        this.historyTable[from * 90 + to] += depth * depth;
    }


    // MVV-LVA (Most Valuable Victim - Least Valuable Aggressor) 排序
    // MVV-LVA (Most Valuable Victim - Least Valuable Aggressor) 排序
    orderMoves(moves, bestMove = null) {
        moves.forEach(move => {
            move.score = 0;
            if (bestMove && move.fromRow === bestMove.fromRow && move.fromCol === bestMove.fromCol && move.toRow === bestMove.toRow && move.toCol === bestMove.toCol) {
                move.score = 2000000; // 置换表最佳移动
            } else {
                const target = this.board[move.toRow][move.toCol];
                const piece = this.board[move.fromRow][move.fromCol];
                if (target !== '.') {
                    // MVV-LVA
                    move.score = 1000000 + (10 * this.getPieceValue(target) - this.getPieceValue(piece));
                } else {
                    // 历史启发
                    move.score = this.getHistoryScore(move.fromRow, move.fromCol, move.toRow, move.toCol);
                }
            }
        });

        moves.sort((a, b) => b.score - a.score);
    }

    // 静态搜索：解决水平线效应，只搜索吃子移动
    quiescenceSearch(alpha, beta, isMaximizing) {
        const evalScore = this.evaluate();

        if (isMaximizing) {
            if (evalScore >= beta) return beta;
            if (evalScore > alpha) alpha = evalScore;
        } else {
            if (evalScore <= alpha) return alpha;
            if (evalScore < beta) beta = evalScore;
        }

        // 只生成吃子移动
        const moves = this.getAllLegalMoves(isMaximizing).filter(move => {
            return this.board[move.toRow][move.toCol] !== '.';
        });

        this.orderMoves(moves);

        for (const move of moves) {
            const originalTarget = this.board[move.toRow][move.toCol];
            const movingPiece = this.board[move.fromRow][move.fromCol];

            this.board[move.toRow][move.toCol] = movingPiece;
            this.board[move.fromRow][move.fromCol] = '.';

            // 递归调用
            const score = this.quiescenceSearch(alpha, beta, !isMaximizing);

            this.board[move.fromRow][move.fromCol] = movingPiece;
            this.board[move.toRow][move.toCol] = originalTarget;

            if (isMaximizing) {
                if (score >= beta) return beta;
                if (score > alpha) alpha = score;
            } else {
                if (score <= alpha) return alpha;
                if (score < beta) beta = score;
            }
        }
        return isMaximizing ? alpha : beta;
    }

    minimax(depth, isMaximizing, alpha, beta) {
        // 1. 检查重复 (搜索路径)
        const stateKey = this.getBoardKey();
        if (this.searchPath && this.searchPath.has(stateKey)) {
            return 0; // 和棋
        }

        // 2. 检查置换表
        // 区分最大化和最小化节点
        const ttKey = stateKey + (isMaximizing ? ':max' : ':min');
        const ttEntry = this.tt.get(ttKey);

        if (ttEntry && ttEntry.depth >= depth) {
            if (ttEntry.flag === 'exact') return ttEntry.score;
            if (ttEntry.flag === 'lower' && ttEntry.score > alpha) alpha = ttEntry.score;
            if (ttEntry.flag === 'upper' && ttEntry.score < beta) beta = ttEntry.score;
            if (alpha >= beta) return ttEntry.score;
        }

        if (depth === 0) {
            return this.quiescenceSearch(alpha, beta, isMaximizing);
        }

        const moves = this.getAllLegalMoves(isMaximizing);

        if (moves.length === 0) {
            // 绝杀或困毙
            return isMaximizing ? -200000 + (10 - depth) : 200000 - (10 - depth);
        }

        // 记录路径
        if (this.searchPath) this.searchPath.add(stateKey);

        // 使用置换表优化排序
        const bestMove = ttEntry ? ttEntry.bestMove : null;
        this.orderMoves(moves, bestMove);

        let bestScore = isMaximizing ? -Infinity : Infinity;
        let bestMoveFound = null;
        let originalAlpha = alpha;
        let originalBeta = beta;

        if (isMaximizing) {
            for (const move of moves) {
                const originalTarget = this.board[move.toRow][move.toCol];
                const movingPiece = this.board[move.fromRow][move.fromCol];

                this.board[move.toRow][move.toCol] = movingPiece;
                this.board[move.fromRow][move.fromCol] = '.';

                const evalScore = this.minimax(depth - 1, false, alpha, beta);

                this.board[move.fromRow][move.fromCol] = movingPiece;
                this.board[move.toRow][move.toCol] = originalTarget;

                if (evalScore > bestScore) {
                    bestScore = evalScore;
                    bestMoveFound = move;
                }
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) {
                    this.updateHistoryScore(move.fromRow, move.fromCol, move.toRow, move.toCol, depth);
                    break;
                }
            }
        } else {
            for (const move of moves) {
                const originalTarget = this.board[move.toRow][move.toCol];
                const movingPiece = this.board[move.fromRow][move.fromCol];

                this.board[move.toRow][move.toCol] = movingPiece;
                this.board[move.fromRow][move.fromCol] = '.';

                const evalScore = this.minimax(depth - 1, true, alpha, beta);

                this.board[move.fromRow][move.fromCol] = movingPiece;
                this.board[move.toRow][move.toCol] = originalTarget;

                if (evalScore < bestScore) {
                    bestScore = evalScore;
                    bestMoveFound = move;
                }
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) {
                    this.updateHistoryScore(move.fromRow, move.fromCol, move.toRow, move.toCol, depth);
                    break;
                }
            }
        }

        // 回溯
        if (this.searchPath) this.searchPath.delete(stateKey);

        // 存入置换表
        let flag = 'exact';
        if (bestScore <= originalAlpha) flag = 'upper';
        else if (bestScore >= originalBeta) flag = 'lower';

        this.tt.set(ttKey, {
            depth: depth,
            score: bestScore,
            flag: flag,
            bestMove: bestMoveFound
        });

        return bestScore;
    }

    getBestMove() {
        // 动态调整深度
        const baseDepth = this.difficulty + 2;
        const maxDepth = 8;
        const timeLimit = 1500; // 1.5秒
        const startTime = Date.now();

        const isRed = false; // AI 是黑方
        let bestMove = null;

        // 0. 查阅开局库
        const boardKey = this.getBoardKey();
        if (XIANGQI_BOOK[boardKey]) {
            const bookMoves = XIANGQI_BOOK[boardKey];
            const randomMove = bookMoves[Math.floor(Math.random() * bookMoves.length)];
            // 验证移动是否合法 (防止开局库错误)
            if (this.isValidMove(randomMove.fromRow, randomMove.fromCol, randomMove.toRow, randomMove.toCol)) {
                return randomMove;
            }
        }

        this.searchPath = new Set(); // 初始化路径记录

        // 迭代加深
        for (let depth = 1; depth <= maxDepth; depth++) {
            if (depth > baseDepth && (Date.now() - startTime > timeLimit)) {
                break;
            }

            const moves = this.getAllLegalMoves(isRed);
            if (moves.length === 0) return null;

            this.orderMoves(moves, bestMove);

            let currentBestMove = null;
            let currentBestValue = Infinity;
            let alpha = -Infinity;
            let beta = Infinity;

            for (const move of moves) {
                const originalTarget = this.board[move.toRow][move.toCol];
                const movingPiece = this.board[move.fromRow][move.fromCol];

                this.board[move.toRow][move.toCol] = movingPiece;
                this.board[move.fromRow][move.fromCol] = '.';

                const boardValue = this.minimax(depth - 1, true, alpha, beta);

                this.board[move.fromRow][move.fromCol] = movingPiece;
                this.board[move.toRow][move.toCol] = originalTarget;

                if (boardValue < currentBestValue) {
                    currentBestValue = boardValue;
                    currentBestMove = move;
                }
                beta = Math.min(beta, boardValue);
            }

            if (currentBestMove) {
                bestMove = currentBestMove;
            }

            if (depth >= baseDepth && (Date.now() - startTime > timeLimit / 2)) {
                break;
            }
        }

        return bestMove;
    }

    checkWin() {
        // 检查老将是否存在
        let redKing = false;
        let blackKing = false;

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] === 'K') redKing = true;
                if (this.board[r][c] === 'k') blackKing = true;
            }
        }

        if (!redKing) return 'black';
        if (!blackKing) return 'red';

        return null;
    }
}
