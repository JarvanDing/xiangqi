// jieqi-engine.js - 揭棋引擎

class JieqiEngine extends XiangqiEngine {
    constructor() {
        super();
        // 初始化揭棋特有的属性
        this.hiddenPieces = []; // 记录哪些棋子是暗棋
        this.originalPositions = []; // 记录棋子的原始位置(用于判断移动规则)
        this.capturedHiddenPieces = []; // 记录被吃掉的暗棋（保持背面朝上）
    }

    reset() {
        // 调用父类的reset来初始化基础棋盘和清空被吃掉的棋子
        super.reset();
        
        // 清空暗棋记录
        this.hiddenPieces = [];
        this.originalPositions = [];
        this.capturedHiddenPieces = [];

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
    // 对于暗棋，AI只能基于位置判断颜色，不能看到真实棋子类型
    evaluate() {
        let score = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p !== '.') {
                    const isHidden = this.isHidden(r, c);
                    
                    if (isHidden) {
                        // 对于暗棋，AI不应该知道真实类型
                        // 1. 基于位置判断颜色（红方在下方 row >= 5，黑方在上方 row < 5）
                        // 2. 使用原始位置类型的期望价值
                        const originalType = this.getHiddenPieceRule(r, c);
                        if (originalType) {
                            // 根据位置判断颜色，而不是从真实棋子类型
                            const isRed = this.isRedSide(r);
                            const expectedValue = this.getExpectedValueForPosition(r, c, originalType);
                            const pstVal = this.getPSTForType(originalType, r, c, isRed);
                            
                            if (isRed) {
                                score += (expectedValue + pstVal);
                            } else {
                                score -= (expectedValue + pstVal);
                            }
                        }
                    } else {
                        // 明棋按正常方式评估（已经翻开，可以看到真实类型）
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

    // 获取某个位置可能的棋子类型的期望价值
    getExpectedValueForPosition(row, col, originalType) {
        // 判断是红方还是黑方
        const isRed = this.isRedSide(row);
        
        // 根据原始位置类型，计算该位置可能的棋子类型的平均价值
        return this.getExpectedValueForOriginalType(originalType, isRed);
    }

    // 根据原始位置类型计算期望价值
    getExpectedValueForOriginalType(originalType, isRed) {
        const type = originalType.toLowerCase();
        
        // 根据原始位置类型，计算该位置可能的所有棋子类型的平均价值
        // 在揭棋中，每个位置打乱后可能放置不同的棋子
        if (type === 'r') {
            // 底线边角位置：可能是车、马、象、士（每种2个，共8个位置）
            // 平均价值 = (车*2 + 马*2 + 象*2 + 士*2) / 8
            const values = [
                this.getPieceValue(isRed ? 'R' : 'r'), // 车
                this.getPieceValue(isRed ? 'N' : 'n'), // 马
                this.getPieceValue(isRed ? 'B' : 'b'), // 象
                this.getPieceValue(isRed ? 'A' : 'a')  // 士
            ];
            return (values[0] * 2 + values[1] * 2 + values[2] * 2 + values[3] * 2) / 8;
        } else if (type === 'c') {
            // 炮位置：可能是任何15个棋子中的任意一个（除了将/帅）
            // 简化：使用所有可能棋子的平均价值
            const values = [
                this.getPieceValue(isRed ? 'R' : 'r'), // 车
                this.getPieceValue(isRed ? 'N' : 'n'), // 马
                this.getPieceValue(isRed ? 'B' : 'b'), // 象
                this.getPieceValue(isRed ? 'A' : 'a'), // 士
                this.getPieceValue(isRed ? 'C' : 'c'), // 炮
                this.getPieceValue(isRed ? 'P' : 'p')  // 兵
            ];
            // 车2个、马2个、象2个、士2个、炮2个、兵5个，共15个
            return (values[0] * 2 + values[1] * 2 + values[2] * 2 + 
                    values[3] * 2 + values[4] * 2 + values[5] * 5) / 15;
        } else if (type === 'p') {
            // 兵位置：可能是任何15个棋子中的任意一个
            // 与炮位置相同
            const values = [
                this.getPieceValue(isRed ? 'R' : 'r'),
                this.getPieceValue(isRed ? 'N' : 'n'),
                this.getPieceValue(isRed ? 'B' : 'b'),
                this.getPieceValue(isRed ? 'A' : 'a'),
                this.getPieceValue(isRed ? 'C' : 'c'),
                this.getPieceValue(isRed ? 'P' : 'p')
            ];
            return (values[0] * 2 + values[1] * 2 + values[2] * 2 + 
                    values[3] * 2 + values[4] * 2 + values[5] * 5) / 15;
        }
        
        // 默认使用原始类型的价值
        const baseChar = isRed ? type.toUpperCase() : type;
        return this.getPieceValue(baseChar);
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
                    if (this.isHidden(r, c)) {
                        // 暗棋：基于位置判断颜色（红方在下方，黑方在上方）
                        isPieceRed = this.isRedSide(r);
                    } else {
                        // 明棋：可以看到真实类型
                        isPieceRed = p === p.toUpperCase();
                    }
                    
                    if (isPieceRed === isRed) {
                        for (let tr = 0; tr < 10; tr++) {
                            for (let tc = 0; tc < 9; tc++) {
                                if (this.isValidMove(r, c, tr, tc)) {
                                    moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
                                }
                            }
                        }
                    }
                }
            }
        }
        return moves;
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
}
