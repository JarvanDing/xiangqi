// 外部AI引擎集成示例
// 用于集成皮卡鱼等外部引擎

/**
 * 皮卡鱼引擎适配器示例
 * 注意：这需要实际的皮卡鱼WebAssembly模块或API
 */
class PikafishEngineAdapter {
    constructor() {
        this.engineLoaded = false;
        this.engineModule = null;
        this.difficulty = 2;
    }

    /**
     * 初始化皮卡鱼引擎
     * 这需要加载WebAssembly模块或连接到API
     */
    async init() {
        try {
            // 示例：加载WebAssembly模块
            // const wasmModule = await import('./pikafish.wasm');
            // this.engineModule = wasmModule;
            
            // 或者连接到API
            // this.apiEndpoint = 'https://api.example.com/pikafish';
            
            this.engineLoaded = true;
            console.log('Pikafish engine initialized');
        } catch (error) {
            console.error('Failed to initialize Pikafish engine:', error);
            this.engineLoaded = false;
        }
    }

    /**
     * 将中国象棋棋盘状态转换为UCI格式（如果需要）
     */
    convertToUCI(boardState) {
        // 将中国象棋棋盘转换为UCI格式
        // 这需要根据实际的UCI协议实现
        // 示例格式：position startpos moves e2e4 e7e5 ...
        return 'position startpos';
    }

    /**
     * 将UCI格式的移动转换为游戏格式
     */
    convertFromUCI(uciMove) {
        // 将UCI格式的移动转换为 {fromRow, fromCol, toRow, toCol}
        // 示例：e2e4 -> {fromRow: 6, fromCol: 4, toRow: 4, toCol: 4}
        return null;
    }

    /**
     * 获取最佳移动
     */
    async getBestMove(boardState, isRedTurn, difficulty) {
        if (!this.engineLoaded) {
            await this.init();
        }

        if (!this.engineLoaded) {
            return null;
        }

        try {
            // 方法1：使用WebAssembly模块
            if (this.engineModule) {
                const uciPosition = this.convertToUCI(boardState);
                const uciMove = await this.engineModule.getBestMove(uciPosition, difficulty);
                return this.convertFromUCI(uciMove);
            }

            // 方法2：使用API调用
            if (this.apiEndpoint) {
                const response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        position: boardState,
                        isRedTurn,
                        difficulty
                    })
                });
                const data = await response.json();
                return data.move;
            }
        } catch (error) {
            console.error('Pikafish engine error:', error);
            return null;
        }
    }
}

/**
 * 创建皮卡鱼引擎的外部引擎适配器
 */
function createPikafishEngine() {
    const pikafishAdapter = new PikafishEngineAdapter();
    
    return new ExternalAIEngine({
        onDifficultyChange: (level) => {
            pikafishAdapter.difficulty = level;
        },
        onReset: () => {
            // 重置引擎状态
        },
        getBestMove: async (boardState, isRedTurn, difficulty, callback) => {
            const move = await pikafishAdapter.getBestMove(boardState, isRedTurn, difficulty);
            callback(move);
        },
        onCleanup: () => {
            // 清理资源
        }
    });
}

/**
 * 在线API引擎适配器示例
 * 用于连接到在线象棋引擎服务
 */
class OnlineAPIEngineAdapter {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.difficulty = 2;
    }

    async getBestMove(boardState, isRedTurn, difficulty) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    board: boardState,
                    turn: isRedTurn ? 'red' : 'black',
                    difficulty: difficulty
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.move; // {fromRow, fromCol, toRow, toCol}
        } catch (error) {
            console.error('Online API engine error:', error);
            return null;
        }
    }
}

/**
 * 注册外部引擎到AI引擎管理器
 */
function registerExternalEngines() {
    // 注册皮卡鱼引擎（如果可用）
    if (typeof ExternalAIEngine !== 'undefined') {
        try {
            const pikafishEngine = createPikafishEngine();
            if (typeof aiEngineManager !== 'undefined') {
                aiEngineManager.registerEngine('pikafish', pikafishEngine);
                console.log('Pikafish engine registered');
            }
        } catch (error) {
            console.warn('Failed to register Pikafish engine:', error);
        }
    }

    // 注册在线API引擎示例
    // const apiUrl = 'https://your-api-endpoint.com/xiangqi/ai';
    // const apiEngine = new ExternalAIEngine({
    //     getBestMove: async (boardState, isRedTurn, difficulty, callback) => {
    //         const adapter = new OnlineAPIEngineAdapter(apiUrl);
    //         const move = await adapter.getBestMove(boardState, isRedTurn, difficulty);
    //         callback(move);
    //     }
    // });
    // aiEngineManager.registerEngine('online-api', apiEngine);
}

// 当DOM加载完成后注册外部引擎
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerExternalEngines);
} else {
    registerExternalEngines();
}
