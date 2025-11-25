// AI引擎适配器系统
// 支持切换不同的AI引擎实现

/**
 * AI引擎接口定义
 * 所有AI引擎必须实现此接口
 */
class AIEngineInterface {
    /**
     * 设置难度级别 (1-3)
     * @param {number} level - 难度级别
     */
    setDifficulty(level) {
        throw new Error('setDifficulty must be implemented');
    }

    /**
     * 获取最佳移动
     * @param {Object} boardState - 棋盘状态
     * @param {boolean} isRedTurn - 是否是红方回合
     * @param {Function} callback - 回调函数，接收最佳移动 {fromRow, fromCol, toRow, toCol}
     */
    getBestMove(boardState, isRedTurn, callback) {
        throw new Error('getBestMove must be implemented');
    }

    /**
     * 重置引擎状态
     */
    reset() {
        throw new Error('reset must be implemented');
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 默认实现为空，子类可以重写
    }
}

/**
 * 内置AI引擎适配器（使用现有的XiangqiEngine）
 */
class BuiltInAIEngine extends AIEngineInterface {
    constructor(EngineClass) {
        super();
        this.EngineClass = EngineClass;
        this.engine = null;
        this.worker = null;
        this.useWorker = typeof Worker !== 'undefined';
        this.difficulty = 2; // 默认难度
    }

    setDifficulty(level) {
        this.difficulty = level;
        if (this.engine) {
            this.engine.setDifficulty(level);
        }
    }

    reset() {
        if (this.engine) {
            this.engine.reset();
        }
    }

    getBestMove(boardState, isRedTurn, callback) {
        if (this.useWorker && !this.worker) {
            this.initWorker();
        }

        if (this.useWorker && this.worker) {
            // 使用Web Worker进行计算
            this.getBestMoveWorker(boardState, isRedTurn, callback);
        } else {
            // 在主线程计算（兼容不支持Worker的环境）
            this.getBestMoveSync(boardState, isRedTurn, callback);
        }
    }

    initWorker() {
        try {
            // 创建Web Worker
            const workerCode = `
                // 导入引擎代码（需要在HTML中通过importScripts加载）
                // 注意：由于Worker的限制，我们需要将引擎代码内联或使用importScripts
                
                let engine = null;
                let EngineClass = null;
                
                self.onmessage = function(e) {
                    const { type, data } = e.data;
                    
                    if (type === 'init') {
                        // 初始化引擎
                        // 注意：由于Worker环境的限制，我们需要通过eval或importScripts加载引擎
                        // 这里简化处理，实际使用时需要根据具体情况调整
                        self.postMessage({ type: 'ready' });
                    } else if (type === 'getBestMove') {
                        // 计算最佳移动
                        const { boardState, isRedTurn, difficulty } = data;
                        
                        // 这里需要实际的引擎实例
                        // 由于Worker环境的复杂性，暂时回退到主线程计算
                        self.postMessage({ 
                            type: 'error', 
                            message: 'Worker mode not fully implemented, falling back to main thread' 
                        });
                    }
                };
            `;
            
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));
            
            this.worker.onmessage = (e) => {
                const { type, move, error } = e.data;
                if (type === 'bestMove' && move) {
                    callback(move);
                } else if (type === 'error') {
                    console.warn('Worker error, falling back to main thread:', error);
                    this.getBestMoveSync(boardState, isRedTurn, callback);
                }
            };
            
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                this.worker = null;
                this.getBestMoveSync(boardState, isRedTurn, callback);
            };
            
            this.worker.postMessage({ type: 'init' });
        } catch (error) {
            console.warn('Failed to create Worker, using main thread:', error);
            this.worker = null;
        }
    }

    getBestMoveWorker(boardState, isRedTurn, callback) {
        // 由于Worker环境的复杂性，暂时使用主线程
        // 未来可以完善Worker实现
        this.getBestMoveSync(boardState, isRedTurn, callback);
    }

    getBestMoveSync(boardState, isRedTurn, callback) {
        // 确保引擎已初始化
        if (!this.engine) {
            this.engine = new this.EngineClass();
            this.engine.setDifficulty(this.difficulty || 2);
        }

        // 恢复棋盘状态（深拷贝）
        this.engine.board = boardState.map(row => [...row]);
        
        // 使用requestAnimationFrame和setTimeout避免阻塞UI
        // 将计算分解为多个小任务
        const startTime = Date.now();
        const timeLimit = 2000; // 2秒超时
        
        const calculateMove = () => {
            try {
                if (Date.now() - startTime > timeLimit) {
                    console.warn('AI calculation timeout');
                    callback(null);
                    return;
                }
                
                const move = this.engine.getBestMove();
                callback(move);
            } catch (error) {
                console.error('AI calculation error:', error);
                callback(null);
            }
        };
        
        // 使用setTimeout让UI有机会更新
        setTimeout(calculateMove, 10);
    }

    cleanup() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

/**
 * 外部引擎适配器（用于集成WebAssembly或API引擎）
 */
class ExternalAIEngine extends AIEngineInterface {
    constructor(config) {
        super();
        this.config = config;
        this.difficulty = 2;
    }

    setDifficulty(level) {
        this.difficulty = level;
        // 通知外部引擎更新难度
        if (this.config.onDifficultyChange) {
            this.config.onDifficultyChange(level);
        }
    }

    reset() {
        if (this.config.onReset) {
            this.config.onReset();
        }
    }

    getBestMove(boardState, isRedTurn, callback) {
        if (this.config.getBestMove) {
            // 调用外部引擎的getBestMove方法
            this.config.getBestMove(boardState, isRedTurn, this.difficulty, callback);
        } else {
            console.error('External engine getBestMove not configured');
            callback(null);
        }
    }

    cleanup() {
        if (this.config.onCleanup) {
            this.config.onCleanup();
        }
    }
}

/**
 * AI引擎管理器
 */
class AIEngineManager {
    constructor() {
        this.engines = new Map();
        this.currentEngine = null;
        this.defaultEngine = 'builtin';
    }

    /**
     * 注册AI引擎
     * @param {string} name - 引擎名称
     * @param {AIEngineInterface} engine - 引擎实例
     */
    registerEngine(name, engine) {
        this.engines.set(name, engine);
    }

    /**
     * 切换AI引擎
     * @param {string} name - 引擎名称
     */
    switchEngine(name) {
        if (!this.engines.has(name)) {
            console.warn(`Engine ${name} not found, using default`);
            name = this.defaultEngine;
        }

        // 清理旧引擎
        if (this.currentEngine && this.currentEngine.cleanup) {
            this.currentEngine.cleanup();
        }

        this.currentEngine = this.engines.get(name);
        return this.currentEngine;
    }

    /**
     * 获取当前引擎
     */
    getCurrentEngine() {
        if (!this.currentEngine) {
            this.switchEngine(this.defaultEngine);
        }
        return this.currentEngine;
    }

    /**
     * 获取所有已注册的引擎名称
     */
    getAvailableEngines() {
        return Array.from(this.engines.keys());
    }

    /**
     * 设置默认引擎
     */
    setDefaultEngine(name) {
        if (this.engines.has(name)) {
            this.defaultEngine = name;
        }
    }
}

// 全局引擎管理器实例
const aiEngineManager = new AIEngineManager();

// 初始化默认引擎
if (typeof XiangqiEngine !== 'undefined') {
    const builtinEngine = new BuiltInAIEngine(XiangqiEngine);
    aiEngineManager.registerEngine('builtin', builtinEngine);
    aiEngineManager.switchEngine('builtin');
}

// 如果存在揭棋引擎，也注册
if (typeof JieqiEngine !== 'undefined') {
    const jieqiEngine = new BuiltInAIEngine(JieqiEngine);
    aiEngineManager.registerEngine('jieqi-builtin', jieqiEngine);
}
