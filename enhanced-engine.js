// 增强版象棋引擎
// 在原有引擎基础上添加更多优化和启发式

class EnhancedXiangqiEngine extends XiangqiEngine {
    constructor() {
        super();
        // 增强的评估函数权重
        this.ENHANCED_WEIGHTS = {
            pieceValue: 1.0,
            positionValue: 1.2,
            mobility: 0.3,
            kingSafety: 0.5,
            pieceActivity: 0.4
        };
    }

    // 增强的评估函数
    evaluate() {
        let score = super.evaluate(); // 基础评估
        
        // 1. 棋子活动性评估（mobility）
        const redMobility = this.calculateMobility(true);
        const blackMobility = this.calculateMobility(false);
        score += (redMobility - blackMobility) * this.ENHANCED_WEIGHTS.mobility;

        // 2. 将/帅安全性评估
        const redKingSafety = this.evaluateKingSafety(true);
        const blackKingSafety = this.evaluateKingSafety(false);
        score += (redKingSafety - blackKingSafety) * this.ENHANCED_WEIGHTS.kingSafety;

        // 3. 棋子协调性评估（piece coordination）
        const redCoordination = this.evaluateCoordination(true);
        const blackCoordination = this.evaluateCoordination(false);
        score += (redCoordination - blackCoordination) * this.ENHANCED_WEIGHTS.pieceActivity;

        // 4. 控制中心评估
        const redCenterControl = this.evaluateCenterControl(true);
        const blackCenterControl = this.evaluateCenterControl(false);
        score += (redCenterControl - blackCenterControl) * 0.2;

        return score;
    }

    // 计算棋子活动性（可移动的格子数）
    calculateMobility(isRed) {
        const moves = this.getAllLegalMoves(isRed);
        return moves.length;
    }

    // 评估将/帅的安全性
    evaluateKingSafety(isRed) {
        const kingChar = isRed ? 'K' : 'k';
        let kingPos = null;
        
        // 找到将/帅的位置
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] === kingChar) {
                    kingPos = { r, c };
                    break;
                }
            }
            if (kingPos) break;
        }
        
        if (!kingPos) return -1000; // 将/帅被吃，非常不安全

        let safety = 0;
        
        // 检查将/帅周围的保护
        const protectionOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of protectionOffsets) {
            const nr = kingPos.r + dr;
            const nc = kingPos.c + dc;
            if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                const piece = this.getPieceAt(nr, nc);
                if (piece) {
                    const isPieceRed = piece === piece.toUpperCase();
                    if (isPieceRed === isRed) {
                        safety += 10; // 己方棋子保护
                    }
                }
            }
        }

        // 检查是否被攻击
        if (this.isKingInCheck(isRed)) {
            safety -= 50; // 被将军，安全性降低
        }

        // 检查将/帅的活动空间
        const kingMoves = this.getAllLegalMoves(isRed).filter(move => {
            const piece = this.getPieceAt(move.fromRow, move.fromCol);
            return piece && piece.toLowerCase() === 'k';
        });
        safety += kingMoves.length * 5; // 活动空间越大越安全

        return safety;
    }

    // 评估棋子协调性（棋子之间的配合）
    evaluateCoordination(isRed) {
        let coordination = 0;
        const pieces = [];
        
        // 收集所有己方棋子
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.getPieceAt(r, c);
                if (piece) {
                    const isPieceRed = piece === piece.toUpperCase();
                    if (isPieceRed === isRed) {
                        pieces.push({ r, c, type: piece.toLowerCase() });
                    }
                }
            }
        }

        // 评估车和炮的配合（双车、双炮等）
        const rooks = pieces.filter(p => p.type === 'r');
        const cannons = pieces.filter(p => p.type === 'c');
        
        if (rooks.length >= 2) {
            coordination += 20; // 双车配合
        }
        if (cannons.length >= 2) {
            coordination += 15; // 双炮配合
        }

        // 评估马和车的配合
        const horses = pieces.filter(p => p.type === 'n');
        if (rooks.length > 0 && horses.length > 0) {
            coordination += 10;
        }

        // 评估兵/卒的配合（过河兵的价值）
        const pawns = pieces.filter(p => p.type === 'p');
        const advancedPawns = pawns.filter(p => {
            if (isRed) {
                return p.r < 5; // 红方过河
            } else {
                return p.r > 4; // 黑方过河
            }
        });
        coordination += advancedPawns.length * 5;

        return coordination;
    }

    // 评估中心控制
    evaluateCenterControl(isRed) {
        let control = 0;
        const centerRows = [4, 5];
        const centerCols = [3, 4, 5];

        for (const r of centerRows) {
            for (const c of centerCols) {
                const piece = this.getPieceAt(r, c);
                if (piece) {
                    const isPieceRed = piece === piece.toUpperCase();
                    if (isPieceRed === isRed) {
                        control += 10;
                    } else {
                        control -= 10;
                    }
                }

                // 检查是否能攻击中心
                const moves = this.getAllLegalMoves(isRed);
                const canAttack = moves.some(m => m.toRow === r && m.toCol === c);
                if (canAttack) {
                    control += 5;
                }
            }
        }

        return control;
    }

    // 重写getBestMove，使用更深的搜索
    getBestMove() {
        // 根据难度调整搜索参数
        const depthMultiplier = this.difficulty === 1 ? 0.8 : (this.difficulty === 2 ? 1.0 : 1.3);
        const originalBaseDepth = this.difficulty + 2;
        this.difficulty = Math.max(1, Math.min(3, Math.floor(originalBaseDepth * depthMultiplier)));
        
        return super.getBestMove();
    }
}
