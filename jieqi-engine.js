// jieqi-engine.js - 揭棋引擎

const JIEQI_BOOK = [
    // 稳健型：挺卒，活通马路，控制河界，试探对方
    { fromRow: 3, fromCol: 4, toRow: 4, toCol: 4 }, // 中卒进一
    { fromRow: 3, fromCol: 2, toRow: 4, toCol: 2 }, // 3路卒进一
    { fromRow: 3, fromCol: 6, toRow: 4, toCol: 6 }, // 7路卒进一
    { fromRow: 3, fromCol: 0, toRow: 4, toCol: 0 }, // 边卒进一
    { fromRow: 3, fromCol: 8, toRow: 4, toCol: 8 }, // 边卒进一
    // 进攻型：直车进一，博取翻出车/炮占据要道，腾出底线空间
    { fromRow: 0, fromCol: 0, toRow: 1, toCol: 0 }, // 左车进一
    { fromRow: 0, fromCol: 8, toRow: 1, toCol: 8 }  // 右车进一
];


class JieqiEngine extends XiangqiEngine {
    constructor() {
        super();
        // 初始化揭棋特有的属性
        this.hiddenPieces = []; // 记录哪些棋子是暗棋
        this.originalPositions = []; // 记录棋子的原始位置(用于判断移动规则)
        this.capturedHiddenPieces = []; // 记录被吃掉的暗棋（保持背面朝上）
        this.tt = new Map(); // 置换表 (Transposition Table)
    }

    reset() {
        // 调用父类的reset来初始化基础棋盘和清空被吃掉的棋子
        super.reset();

        // 清空暗棋记录
        this.hiddenPieces = [];
        this.originalPositions = [];
        this.capturedHiddenPieces = [];
        this.tt.clear(); // 清空置换表

        // 分别准备红方和黑方的棋子
        const redPieces = [
            'R', 'N', 'B', 'A', 'A', 'B', 'N', 'R', // 底线8个
            'C', 'C', // 炮2个
            'P', 'P', 'P', 'P', 'P'  // 兵5个
        ];

        const blackPieces = [
            'r', 'n', 'b', 'a', 'a', 'b', 'n', 'r', // 底线8个
            'c', 'c', // 炮2个
            'p', 'p', 'p', 'p', 'p'  // 卒5个
        ];

        // 分别打乱红方和黑方的棋子
        this.shuffleArray(redPieces);
        this.shuffleArray(blackPieces);

        // 初始化棋盘
        this.board = Array(10).fill(null).map(() => Array(9).fill('.'));

        // 放置将/帅(明棋)
        this.board[0][4] = 'k'; // 黑将
        this.board[9][4] = 'K'; // 红帅

        // 放置黑方暗棋
        let blackIndex = 0;

        // 黑方底线 (第0行,跳过中间的将)
        for (let c of [0, 1, 2, 3, 5, 6, 7, 8]) {
            this.board[0][c] = blackPieces[blackIndex];
            this.hiddenPieces.push({ row: 0, col: c });
            this.originalPositions.push({ row: 0, col: c, type: this.getOriginalPieceType(0, c, false) });
            blackIndex++;
        }

        // 黑方炮位置 (第2行)
        for (let c of [1, 7]) {
            this.board[2][c] = blackPieces[blackIndex];
            this.hiddenPieces.push({ row: 2, col: c });
            this.originalPositions.push({ row: 2, col: c, type: 'c' });
            blackIndex++;
        }

        // 黑方卒位置 (第3行)
        for (let c of [0, 2, 4, 6, 8]) {
            this.board[3][c] = blackPieces[blackIndex];
            this.hiddenPieces.push({ row: 3, col: c });
            this.originalPositions.push({ row: 3, col: c, type: 'p' });
            blackIndex++;
        }

        // 放置红方暗棋
        let redIndex = 0;

        // 红方兵位置 (第6行)
        for (let c of [0, 2, 4, 6, 8]) {
            this.board[6][c] = redPieces[redIndex];
            this.hiddenPieces.push({ row: 6, col: c });
            this.originalPositions.push({ row: 6, col: c, type: 'p' });
            redIndex++;
        }

        // 红方炮位置 (第7行)
        for (let c of [1, 7]) {
            this.board[7][c] = redPieces[redIndex];
            this.hiddenPieces.push({ row: 7, col: c });
            this.originalPositions.push({ row: 7, col: c, type: 'c' });
            redIndex++;
        }

        // 红方底线 (第9行,跳过中间的帅)
        for (let c of [0, 1, 2, 3, 5, 6, 7, 8]) {
            this.board[9][c] = redPieces[redIndex];
            this.hiddenPieces.push({ row: 9, col: c });
            this.originalPositions.push({ row: 9, col: c, type: this.getOriginalPieceType(9, c, true) });
            redIndex++;
        }

        this.history = [];
    }

    // 生成当前状态的唯一哈希键
    getHashKey() {
        // 基础棋盘键
        let key = super.getBoardKey();

        // 添加暗棋信息 (排序以确保唯一性)
        // 格式: row,col
        if (this.hiddenPieces.length > 0) {
            const hiddenStr = this.hiddenPieces
                .map(p => `${p.row},${p.col}`)
                .sort()
                .join('|');
            key += `#H:${hiddenStr}`;
        }

        // 添加原始位置信息
        // 格式: row,col,type
        if (this.originalPositions.length > 0) {
            const originalStr = this.originalPositions
                .map(p => `${p.row},${p.col},${p.type}`)
                .sort()
                .join('|');
            key += `#O:${originalStr}`;
        }

        return key;
    }

    // 获取原始位置对应的棋子类型
    getOriginalPieceType(row, col, isRed) {
        // 底线
        if (row === 0 || row === 9) {
            if (col === 0 || col === 8) return 'r'; // 车
            if (col === 1 || col === 7) return 'n'; // 马
            if (col === 2 || col === 6) return 'b'; // 象
            if (col === 3 || col === 5) return 'a'; // 士
            if (col === 4) return 'k'; // 将/帅
        }
        // 炮
        if ((row === 2 || row === 7) && (col === 1 || col === 7)) return 'c';
        // 兵/卒
        if ((row === 3 || row === 6) && [0, 2, 4, 6, 8].includes(col)) return 'p';
        return null;
    }

    // 打乱数组
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 检查是否是暗棋
    isHidden(row, col) {
        return this.hiddenPieces.some(p => p.row === row && p.col === col);
    }

    // 翻开棋子（当棋子移动时调用）
    revealPiece(row, col) {
        // 从hiddenPieces中移除（棋子翻开了）
        this.hiddenPieces = this.hiddenPieces.filter(p => !(p.row === row && p.col === col));
    }

    // 重写undo以恢复originalPositions和被吃掉的暗棋记录
    undo() {
        const move = super.undo();
        if (!move) return null;

        // 如果撤销的是吃子操作，需要从capturedHiddenPieces中移除对应的记录
        if (move.captured && move.captured !== '.' && this.capturedHiddenPieces && this.capturedHiddenPieces.length > 0) {
            const isRed = move.captured === move.captured.toUpperCase();
            const arrayName = isRed ? 'red' : 'black';
            const array = isRed ? this.capturedRed : this.capturedBlack;
            // 撤销后，被吃掉的棋子已经从数组末尾移除，所以最后一个元素对应的索引是 array.length
            // 我们需要移除最后一个匹配该数组的记录
            const targetIndex = array.length;
            const hiddenKey = `${arrayName}-${targetIndex}`;

            // 查找并移除最后一个匹配的记录（从后往前找，因为最后吃掉的应该最后撤销）
            let found = false;
            for (let i = this.capturedHiddenPieces.length - 1; i >= 0; i--) {
                if (this.capturedHiddenPieces[i] === hiddenKey) {
                    this.capturedHiddenPieces.splice(i, 1);
                    found = true;
                    break;
                }
            }

            // 如果没找到精确匹配，可能是索引偏移问题，移除最后一个匹配该数组的记录
            if (!found) {
                for (let i = this.capturedHiddenPieces.length - 1; i >= 0; i--) {
                    if (this.capturedHiddenPieces[i].startsWith(`${arrayName}-`)) {
                        this.capturedHiddenPieces.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // 恢复originalPositions
        // 需要从历史记录中恢复，但这里简化处理：重新计算
        // 实际上，应该在history中保存originalPositions的变化
        // 为了简化，这里不做详细恢复，因为undo后通常会重新渲染

        return move;
    }

    // 获取暗棋应该按照的规则(根据原始位置)
    getHiddenPieceRule(row, col) {
        // 查找当前位置对应的原始位置类型
        // 如果棋子已经移动过，需要从历史记录中查找它的原始位置
        const pos = this.originalPositions.find(p => p.row === row && p.col === col);
        if (pos) return pos.type;

        // 如果当前位置没有找到，可能是棋子已经移动过了
        // 需要从历史记录中查找这个棋子最初的位置类型
        // 简化处理：如果找不到，返回null（这种情况不应该发生）
        return null;
    }

    // 重写movePiece以更新originalPositions和处理暗棋翻开
    movePiece(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];
        const wasHidden = this.isHidden(fromRow, fromCol);
        const capturedWasHidden = captured && captured !== '.' ? this.isHidden(toRow, toCol) : false;

        // 如果移动的是暗棋，先从旧位置移除（在移动之前）
        if (wasHidden) {
            this.hiddenPieces = this.hiddenPieces.filter(p => !(p.row === fromRow && p.col === fromCol));
        }

        // 调用父类的movePiece（会更新棋盘和captured数组）
        super.movePiece(fromRow, fromCol, toRow, toCol);

        // 【修复】更新历史记录中的 Key 为包含暗棋信息的完整 Key
        // 这样 isValidMove 中的 willCauseRepetition 就能正确识别揭棋的重复局面
        if (this.history.length > 0) {
            this.history[this.history.length - 1].key = this.getHashKey();
        }

        // 如果吃掉了暗棋，记录为暗棋（保持背面朝上）
        if (captured && captured !== '.' && capturedWasHidden) {
            if (!this.capturedHiddenPieces) {
                this.capturedHiddenPieces = [];
            }
            // 记录被吃掉的暗棋：使用数组名和索引作为标识
            const isRed = captured === captured.toUpperCase();
            const arrayName = isRed ? 'red' : 'black';
            const array = isRed ? this.capturedRed : this.capturedBlack;
            const index = array.length - 1; // 刚添加的元素的索引
            // 使用字符串标识：'red-0', 'black-1' 等
            this.capturedHiddenPieces.push(`${arrayName}-${index}`);
        }

        // 更新originalPositions：将原始位置信息移动到新位置
        const fromPos = this.originalPositions.find(p => p.row === fromRow && p.col === fromCol);
        if (fromPos) {
            // 移除旧位置的记录
            this.originalPositions = this.originalPositions.filter(p => !(p.row === fromRow && p.col === fromCol));
            // 在新位置添加记录（即使已经翻开，也保留原始位置信息，以防需要）
            this.originalPositions.push({ row: toRow, col: toCol, type: fromPos.type });
        }

        // 如果吃掉了棋子，移除被吃掉棋子的originalPositions和hiddenPieces记录
        if (captured && captured !== '.') {
            // 移除被吃掉棋子的originalPositions（注意：此时fromPos可能已经更新，需要排除它）
            this.originalPositions = this.originalPositions.filter(p => {
                // 保留刚刚添加的新位置的记录
                if (fromPos && p.row === toRow && p.col === toCol && p.type === fromPos.type) {
                    return true;
                }
                // 移除其他在toRow, toCol位置的记录（被吃掉的棋子）
                return !(p.row === toRow && p.col === toCol);
            });
            // 如果被吃掉的棋子是暗棋，也要从hiddenPieces中移除
            this.hiddenPieces = this.hiddenPieces.filter(p => !(p.row === toRow && p.col === toCol));
        }
    }

    // 重写移动验证 - 揭棋特殊规则
    // 对于暗棋，AI只能基于位置判断颜色，不能看到真实类型
    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPieceAt(fromRow, fromCol);
        if (!piece) return false;

        const isHiddenPiece = this.isHidden(fromRow, fromCol);

        // 判断颜色：暗棋基于位置，明棋可以看到真实类型
        let isRed;
        if (isHiddenPiece) {
            // 暗棋：基于位置判断（红方在下方 row >= 5）
            isRed = this.isRedSide(fromRow);
        } else {
            // 明棋：可以看到真实类型
            isRed = piece === piece.toUpperCase();
        }

        // 1. 基本几何验证
        let geometricallyValid = false;
        if (isHiddenPiece) {
            const ruleType = this.getHiddenPieceRule(fromRow, fromCol);
            if (!ruleType) return false;
            geometricallyValid = this.isGeometricallyValidForType(fromRow, fromCol, toRow, toCol, ruleType, isRed);
        } else {
            geometricallyValid = this.isGeometricallyValidJieqi(fromRow, fromCol, toRow, toCol);
        }

        if (!geometricallyValid) return false;

        // 2. 模拟移动以检查"飞将"和"自杀"
        const originalTarget = this.board[toRow][toCol];
        const movingPiece = this.board[fromRow][fromCol];

        this.board[toRow][toCol] = movingPiece;
        this.board[fromRow][fromCol] = '.';

        let valid = true;

        // 检查飞将（将和帅都是明棋，可以直接检查）
        if (this.isKingsFacing()) {
            valid = false;
        }
        // 检查己方老将是否受攻击（自杀）- 使用重写的isKingInCheck
        else if (this.isKingInCheck(isRed)) {
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

    // 揭棋的几何验证(士象可过河)
    isGeometricallyValidJieqi(fromRow, fromCol, toRow, toCol) {
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
            case 'b': return this.isValidElephantMoveJieqi(fromRow, fromCol, toRow, toCol); // 可过河
            case 'a': return this.isValidAdvisorMoveJieqi(fromRow, fromCol, toRow, toCol); // 可过河
            case 'k': return this.isValidKingMove(fromRow, fromCol, toRow, toCol, isRed);
            case 'c': return this.isValidCannonMove(fromRow, fromCol, toRow, toCol);
            case 'p': return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, isRed);
            default: return false;
        }
    }

    // 根据类型验证移动（用于暗棋，不依赖真实棋子类型）
    isGeometricallyValidForType(fromRow, fromCol, toRow, toCol, type, isRed) {
        if (fromRow === toRow && fromCol === toCol) return false;
        if (toRow < 0 || toRow > 9 || toCol < 0 || toCol > 8) return false;

        const target = this.getPieceAt(toRow, toCol);

        // 不能吃己方棋子
        // 对于暗棋目标，基于位置判断颜色；对于明棋目标，可以看到真实类型
        if (target) {
            let isTargetRed;
            if (this.isHidden(toRow, toCol)) {
                // 目标也是暗棋，基于位置判断颜色
                isTargetRed = this.isRedSide(toRow);
            } else {
                // 目标是明棋，可以看到真实类型
                isTargetRed = target === target.toUpperCase();
            }
            if (isRed === isTargetRed) return false;
        }

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

    // 揭棋版象的移动(可过河)
    isValidElephantMoveJieqi(r1, c1, r2, c2) {
        if (Math.abs(r2 - r1) !== 2 || Math.abs(c2 - c1) !== 2) return false;

        // 检查塞象眼
        const midR = (r1 + r2) / 2;
        const midC = (c1 + c2) / 2;
        if (this.getPieceAt(midR, midC)) return false;

        return true; // 可以过河
    }

    // 揭棋版士的移动(可过河)
    isValidAdvisorMoveJieqi(r1, c1, r2, c2) {
        if (Math.abs(r2 - r1) !== 1 || Math.abs(c2 - c1) !== 1) return false;
        return true; // 可以过河,不限九宫
    }

    // 重写评估函数：AI不应该知道暗棋的真实身份
    // 优化：使用动态概率计算暗棋价值
    evaluate() {
        let score = 0;

        // 使用预计算的暗棋平均价值 (在 getBestMove 中计算)
        // 如果没有预计算（如在UI显示评估分时），则实时计算
        const redHiddenAvg = this.currentRedHiddenAvg !== undefined ? this.currentRedHiddenAvg : this.getAverageHiddenValue(true);
        const blackHiddenAvg = this.currentBlackHiddenAvg !== undefined ? this.currentBlackHiddenAvg : this.getAverageHiddenValue(false);

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p !== '.') {
                    const isHidden = this.isHidden(r, c);

                    if (isHidden) {
                        // 对于暗棋，AI不应该知道真实类型
                        const originalType = this.getHiddenPieceRule(r, c);
                        if (originalType) {
                            const isRed = this.isRedSide(r);
                            // 1. 基础价值：暗棋的平均期望价值
                            const expectedValue = isRed ? redHiddenAvg : blackHiddenAvg;

                            // 2. 角色加成 (Role Bonus)：
                            // 暗棋在未揭开前，具有该位置棋子的移动能力和威慑力。
                            // 例如：暗车虽然本质是随机的，但它不动时能封锁线路，具有“假车”的战术价值。
                            // 我们给予它当前角色价值的 25% 作为“威慑分”，鼓励 AI 保留强力暗棋（如车/炮）。
                            const roleChar = isRed ? originalType.toUpperCase() : originalType;
                            const roleValue = this.getPieceValue(roleChar);
                            const roleBonus = roleValue * 0.25;

                            const finalValue = expectedValue + roleBonus;

                            // 3. 位置价值：使用当前角色的 PST
                            const pstVal = this.getPSTForType(originalType, r, c, isRed);

                            if (isRed) {
                                score += (finalValue + pstVal);
                            } else {
                                score -= (finalValue + pstVal);
                            }
                        }
                    } else {
                        // 明棋按正常方式评估
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
        }
        return score;
    }

    // 获取暗棋的动态平均价值
    getAverageHiddenValue(isRed) {
        const initialCounts = { 'r': 2, 'n': 2, 'b': 2, 'a': 2, 'c': 2, 'p': 5 };
        const visibleCounts = { 'r': 0, 'n': 0, 'b': 0, 'a': 0, 'c': 0, 'p': 0 };

        // 1. 统计棋盘上的明棋
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p && p !== '.') {
                    const isPieceRed = (p === p.toUpperCase());
                    if (isPieceRed === isRed && !this.isHidden(r, c)) {
                        const type = p.toLowerCase();
                        if (visibleCounts[type] !== undefined) visibleCounts[type]++;
                    }
                }
            }
        }

        // 2. 统计被吃掉的明棋
        const capturedArray = isRed ? this.capturedRed : this.capturedBlack;
        const capturedHiddenArray = this.capturedHiddenPieces || [];
        const arrayName = isRed ? 'red' : 'black';

        if (capturedArray) {
            capturedArray.forEach((p, index) => {
                // 检查这个索引是否在 capturedHiddenPieces 中
                const isHiddenCapture = capturedHiddenArray.some(id => id === `${arrayName}-${index}`);
                if (!isHiddenCapture) {
                    const type = p.toLowerCase();
                    if (visibleCounts[type] !== undefined) visibleCounts[type]++;
                }
            });
        }

        // 计算剩余未知棋子的总价值和数量
        let totalValue = 0;
        let totalCount = 0;

        for (const type in initialCounts) {
            const count = initialCounts[type] - visibleCounts[type];
            if (count > 0) {
                const pieceChar = isRed ? type.toUpperCase() : type;
                totalValue += this.getPieceValue(pieceChar) * count;
                totalCount += count;
            }
        }

        return totalCount > 0 ? totalValue / totalCount : 0;
    }

    // 获取某个位置可能的棋子类型的期望价值 (保留此方法以兼容，但建议使用 getAverageHiddenValue)
    getExpectedValueForPosition(row, col, originalType) {
        const isRed = this.isRedSide(row);
        return this.getAverageHiddenValue(isRed);
    }

    // 根据原始位置类型计算期望价值 (已废弃，由 getAverageHiddenValue 替代)
    getExpectedValueForOriginalType(originalType, isRed) {
        return this.getAverageHiddenValue(isRed);
    }

    // 判断是否是红方区域
    isRedSide(row) {
        return row >= 5;
    }

    // 重写getAllLegalMoves：对于暗棋，基于位置判断颜色，不依赖真实类型
    getAllLegalMoves(isRed) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p && p !== '.') {
                    // 判断是否是己方棋子
                    let isPieceRed;
                    let pieceType;
                    if (this.isHidden(r, c)) {
                        // 暗棋：基于位置判断颜色（红方在下方，黑方在上方）
                        isPieceRed = this.isRedSide(r);
                        // 获取原始位置类型
                        pieceType = this.getHiddenPieceRule(r, c);
                    } else {
                        // 明棋：可以看到真实类型
                        isPieceRed = p === p.toUpperCase();
                        pieceType = p.toLowerCase();
                    }

                    if (isPieceRed === isRed && pieceType) {
                        // 优化：根据棋子类型生成可能的移动，而不是遍历所有90个目标位置
                        const possibleTargets = this.generatePossibleTargetsJieqi(r, c, pieceType, isPieceRed);
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

    // 根据棋子类型生成可能的目标位置（揭棋版本，考虑暗棋和揭棋规则）
    generatePossibleTargetsJieqi(r, c, type, isRed) {
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
                // 象：4个可能位置（揭棋可过河）
                const offsets = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
                offsets.forEach(([dr, dc]) => {
                    const tr = r + dr, tc = c + dc;
                    if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) targets.push({ r: tr, c: tc });
                });
            },
            'a': () => {
                // 士：4个可能位置（揭棋可过河）
                const offsets = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                offsets.forEach(([dr, dc]) => {
                    const tr = r + dr, tc = c + dc;
                    if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) targets.push({ r: tr, c: tc });
                });
            },
            'k': () => {
                // 将/帅：4个可能位置（限制在九宫格内）
                const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                offsets.forEach(([dr, dc]) => {
                    const tr = r + dr, tc = c + dc;
                    if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) {
                        // 九宫格限制
                        if (tc >= 3 && tc <= 5) {
                            if (isRed && tr >= 7 && tr <= 9) targets.push({ r: tr, c: tc });
                            else if (!isRed && tr >= 0 && tr <= 2) targets.push({ r: tr, c: tc });
                        }
                    }
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

    // 根据类型获取位置价值（不依赖真实棋子类型）
    getPSTForType(type, r, c, isRed) {
        // 使用原始类型来获取位置价值
        const baseType = type.toLowerCase();
        const pieceChar = isRed ? baseType.toUpperCase() : baseType;
        return this.getPST(pieceChar, r, c);
    }

    // 重写isKingInCheck：对于暗棋，基于位置判断是否是敌方，不依赖真实类型
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
                    // 判断是否是敌方棋子
                    let isPieceRed;
                    if (this.isHidden(r, c)) {
                        // 暗棋：基于位置判断颜色
                        isPieceRed = this.isRedSide(r);
                    } else {
                        // 明棋：可以看到真实类型
                        isPieceRed = p === p.toUpperCase();
                    }

                    if (isPieceRed !== isRed) {
                        // 敌方棋子，检查是否可以攻击老将
                        // 对于暗棋，需要基于原始位置类型判断
                        if (this.isHidden(r, c)) {
                            const ruleType = this.getHiddenPieceRule(r, c);
                            if (ruleType && this.isGeometricallyValidForType(r, c, kingPos.r, kingPos.c, ruleType, isPieceRed)) {
                                return true;
                            }
                        } else {
                            // 明棋：使用正常验证
                            if (this.isGeometricallyValidJieqi(r, c, kingPos.r, kingPos.c)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }
    // 辅助方法：在搜索中更新状态
    updateStateForMove(fromRow, fromCol, toRow, toCol) {
        const state = {
            movedHiddenIdx: -1,
            movedOriginalIdx: -1,
            capturedHiddenIdx: -1,
            capturedOriginalIdx: -1,
            oldHiddenPos: null,
            oldOriginalPos: null,
            capturedHiddenPos: null,
            capturedOriginalPos: null
        };

        // 1. 处理被吃掉的棋子 (Target)
        // 不使用 splice，而是修改坐标为 -1，保持数组索引稳定
        const targetHiddenIdx = this.hiddenPieces.findIndex(p => p.row === toRow && p.col === toCol);
        if (targetHiddenIdx !== -1) {
            state.capturedHiddenIdx = targetHiddenIdx;
            state.capturedHiddenPos = { ...this.hiddenPieces[targetHiddenIdx] };
            this.hiddenPieces[targetHiddenIdx].row = -1;
            this.hiddenPieces[targetHiddenIdx].col = -1;
        }

        const targetOriginalIdx = this.originalPositions.findIndex(p => p.row === toRow && p.col === toCol);
        if (targetOriginalIdx !== -1) {
            state.capturedOriginalIdx = targetOriginalIdx;
            state.capturedOriginalPos = { ...this.originalPositions[targetOriginalIdx] };
            this.originalPositions[targetOriginalIdx].row = -1;
            this.originalPositions[targetOriginalIdx].col = -1;
        }

        // 2. 处理移动的棋子 (Source)
        state.movedHiddenIdx = this.hiddenPieces.findIndex(p => p.row === fromRow && p.col === fromCol);
        if (state.movedHiddenIdx !== -1) {
            state.oldHiddenPos = { ...this.hiddenPieces[state.movedHiddenIdx] };
            this.hiddenPieces[state.movedHiddenIdx].row = toRow;
            this.hiddenPieces[state.movedHiddenIdx].col = toCol;
        }

        state.movedOriginalIdx = this.originalPositions.findIndex(p => p.row === fromRow && p.col === fromCol);
        if (state.movedOriginalIdx !== -1) {
            state.oldOriginalPos = { ...this.originalPositions[state.movedOriginalIdx] };
            this.originalPositions[state.movedOriginalIdx].row = toRow;
            this.originalPositions[state.movedOriginalIdx].col = toCol;
        }

        return state;
    }

    // 辅助方法：恢复状态
    restoreStateAfterMove(fromRow, fromCol, toRow, toCol, state) {
        // 1. 恢复移动的棋子
        if (state.movedOriginalIdx !== -1) {
            this.originalPositions[state.movedOriginalIdx].row = state.oldOriginalPos.row;
            this.originalPositions[state.movedOriginalIdx].col = state.oldOriginalPos.col;
        }

        if (state.movedHiddenIdx !== -1) {
            this.hiddenPieces[state.movedHiddenIdx].row = state.oldHiddenPos.row;
            this.hiddenPieces[state.movedHiddenIdx].col = state.oldHiddenPos.col;
        }

        // 2. 恢复被吃掉的棋子
        if (state.capturedOriginalIdx !== -1) {
            this.originalPositions[state.capturedOriginalIdx].row = state.capturedOriginalPos.row;
            this.originalPositions[state.capturedOriginalIdx].col = state.capturedOriginalPos.col;
        }
        if (state.capturedHiddenIdx !== -1) {
            this.hiddenPieces[state.capturedHiddenIdx].row = state.capturedHiddenPos.row;
            this.hiddenPieces[state.capturedHiddenIdx].col = state.capturedHiddenPos.col;
        }
    }

    // 重写 orderMoves：使用期望价值进行排序，支持置换表最佳移动优先
    orderMoves(moves, bestMove = null) {
        // 预先计算暗棋价值，避免在循环中重复计算
        const redHiddenAvg = this.currentRedHiddenAvg !== undefined ? this.currentRedHiddenAvg : this.getAverageHiddenValue(true);
        const blackHiddenAvg = this.currentBlackHiddenAvg !== undefined ? this.currentBlackHiddenAvg : this.getAverageHiddenValue(false);

        moves.forEach(move => {
            move.score = 0;
            // 1. 置换表最佳移动优先
            if (bestMove && move.fromRow === bestMove.fromRow && move.fromCol === bestMove.fromCol && move.toRow === bestMove.toRow && move.toCol === bestMove.toCol) {
                move.score = 2000000;
                return;
            }

            const target = this.board[move.toRow][move.toCol];
            const piece = this.board[move.fromRow][move.fromCol];

            if (target !== '.') {
                // MVV-LVA
                let targetVal = 0;
                if (this.isHidden(move.toRow, move.toCol)) {
                    targetVal = this.isRedSide(move.toRow) ? redHiddenAvg : blackHiddenAvg;
                } else {
                    targetVal = this.getPieceValue(target);
                }

                let pieceVal = 0;
                if (this.isHidden(move.fromRow, move.fromCol)) {
                    pieceVal = this.isRedSide(move.fromRow) ? redHiddenAvg : blackHiddenAvg;
                } else {
                    pieceVal = this.getPieceValue(piece);
                }

                move.score = 1000000 + (10 * targetVal - pieceVal);
            } else {
                // 历史启发
                move.score = this.getHistoryScore(move.fromRow, move.fromCol, move.toRow, move.toCol);
            }
        });

        moves.sort((a, b) => b.score - a.score);
    }

    // 重写 quiescenceSearch
    quiescenceSearch(alpha, beta, isMaximizing) {
        const evalScore = this.evaluate();

        if (isMaximizing) {
            if (evalScore >= beta) return beta;
            if (evalScore > alpha) alpha = evalScore;
        } else {
            if (evalScore <= alpha) return alpha;
            if (evalScore < beta) beta = evalScore;
        }

        const moves = this.getAllLegalMoves(isMaximizing).filter(move => {
            return this.board[move.toRow][move.toCol] !== '.';
        });

        this.orderMoves(moves);

        for (const move of moves) {
            const originalTarget = this.board[move.toRow][move.toCol];
            const movingPiece = this.board[move.fromRow][move.fromCol];

            // 更新状态（暗棋跟随移动）
            const state = this.updateStateForMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

            this.board[move.toRow][move.toCol] = movingPiece;
            this.board[move.fromRow][move.fromCol] = '.';

            const score = this.quiescenceSearch(alpha, beta, !isMaximizing);

            this.board[move.fromRow][move.fromCol] = movingPiece;
            this.board[move.toRow][move.toCol] = originalTarget;

            // 恢复状态
            this.restoreStateAfterMove(move.fromRow, move.fromCol, move.toRow, move.toCol, state);

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

    // 重写 minimax，加入置换表支持
    minimax(depth, isMaximizing, alpha, beta) {
        // 1. 检查置换表
        const stateKey = this.getHashKey();

        // 【修复】检查搜索路径重复 (Path Repetition)
        // 防止 AI 在思考过程中陷入 A->B->A 的死循环，导致反复将军
        if (this.searchPath && this.searchPath.has(stateKey)) {
            return 0; // 视为和棋
        }

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
            return isMaximizing ? -200000 + (10 - depth) : 200000 - (10 - depth);
        }

        // 记录当前路径
        if (this.searchPath) this.searchPath.add(stateKey);

        // 使用置换表中的最佳移动来优化排序
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

                const state = this.updateStateForMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

                this.board[move.toRow][move.toCol] = movingPiece;
                this.board[move.fromRow][move.fromCol] = '.';

                const evalScore = this.minimax(depth - 1, false, alpha, beta);

                this.board[move.fromRow][move.fromCol] = movingPiece;
                this.board[move.toRow][move.toCol] = originalTarget;

                this.restoreStateAfterMove(move.fromRow, move.fromCol, move.toRow, move.toCol, state);

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

                const state = this.updateStateForMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

                this.board[move.toRow][move.toCol] = movingPiece;
                this.board[move.fromRow][move.fromCol] = '.';

                const evalScore = this.minimax(depth - 1, true, alpha, beta);

                this.board[move.fromRow][move.fromCol] = movingPiece;
                this.board[move.toRow][move.toCol] = originalTarget;

                this.restoreStateAfterMove(move.fromRow, move.fromCol, move.toRow, move.toCol, state);

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

        // 回溯：移除当前路径记录
        if (this.searchPath) this.searchPath.delete(stateKey);

        // 存储结果到置换表
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

    // 重写 getBestMove：使用迭代加深 (Iterative Deepening) 和置换表
    getBestMove() {
        // 移除昂贵的深拷贝，依赖 restoreStateAfterMove 保持状态一致性

        // 动态调整深度和时间限制
        const baseDepth = this.difficulty + 2; // 基础深度增加，因为有优化
        const maxDepth = 8; // 最大深度限制
        const timeLimit = 1500; // 时间限制 1.5 秒
        const startTime = Date.now();

        const isRed = false; // AI 是黑方
        let bestMove = null;

        // 预计算暗棋平均价值，供搜索期间使用 (避免重复计算)
        this.currentRedHiddenAvg = this.getAverageHiddenValue(true);
        this.currentBlackHiddenAvg = this.getAverageHiddenValue(false);

        // 0. 查阅开局库 (仅第一步)
        if (this.history.length === 0) {
            const randomMove = JIEQI_BOOK[Math.floor(Math.random() * JIEQI_BOOK.length)];
            if (this.isValidMove(randomMove.fromRow, randomMove.fromCol, randomMove.toRow, randomMove.toCol)) {
                return randomMove;
            }
        }

        // 初始化搜索路径记录 (用于检测重复)
        this.searchPath = new Set();

        // 迭代加深搜索
        for (let depth = 1; depth <= maxDepth; depth++) {
            // 如果超过基础深度且超时，则停止
            if (depth > baseDepth && (Date.now() - startTime > timeLimit)) {
                break;
            }

            const moves = this.getAllLegalMoves(isRed);
            if (moves.length === 0) return null;

            // 使用上一层迭代的 bestMove 进行排序优化
            this.orderMoves(moves, bestMove);

            let currentBestMove = null;
            let currentBestValue = Infinity; // AI 是黑方，寻找最小值
            let alpha = -Infinity;
            let beta = Infinity;

            for (const move of moves) {
                const originalTarget = this.board[move.toRow][move.toCol];
                const movingPiece = this.board[move.fromRow][move.fromCol];

                const state = this.updateStateForMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

                this.board[move.toRow][move.toCol] = movingPiece;
                this.board[move.fromRow][move.fromCol] = '.';

                // 根节点是 Min 层，下一层是 Max 层
                const boardValue = this.minimax(depth - 1, true, alpha, beta);

                this.board[move.fromRow][move.fromCol] = movingPiece;
                this.board[move.toRow][move.toCol] = originalTarget;

                this.restoreStateAfterMove(move.fromRow, move.fromCol, move.toRow, move.toCol, state);

                if (boardValue < currentBestValue) {
                    currentBestValue = boardValue;
                    currentBestMove = move;
                }
                beta = Math.min(beta, boardValue);
            }

            if (currentBestMove) {
                bestMove = currentBestMove;
            }

            // 简单的时间检查：如果这一层花了一半以上的时间，下一层很可能不够，直接退出
            // (仅在达到基础深度后检查)
            if (depth >= baseDepth && (Date.now() - startTime > timeLimit / 2)) {
                break;
            }
        }

        return bestMove;
    }
}
