# AI引擎集成指南

本项目已实现了一个灵活的AI引擎适配器系统，支持切换不同的AI引擎，并可以轻松集成外部引擎（如皮卡鱼等）。

## 功能特性

1. **多引擎支持**：可以在不同AI引擎之间切换
2. **统一接口**：所有引擎使用统一的接口，便于集成
3. **异步计算**：AI计算不阻塞UI线程
4. **可扩展性**：易于添加新的AI引擎

## 当前可用的引擎

### 1. 内置引擎 (builtin)
- 基于Minimax算法
- 支持Alpha-Beta剪枝
- 包含置换表、历史启发等优化

### 2. 增强内置引擎 (builtin-enhanced)
- 在基础引擎上增加了更多启发式评估
- 包括棋子活动性、将/帅安全性、棋子协调性等评估
- 提供更强的AI能力

## 如何使用

### 在UI中切换引擎

游戏界面中有一个"AI 引擎"下拉菜单，可以选择不同的引擎：

```html
<select id="ai-engine">
    <option value="builtin" selected>内置引擎</option>
    <option value="builtin-enhanced">增强内置引擎</option>
</select>
```

### 在代码中使用

```javascript
// 获取当前引擎
const engine = aiEngineManager.getCurrentEngine();

// 切换引擎
aiEngineManager.switchEngine('builtin-enhanced');

// 设置难度
engine.setDifficulty(2);

// 获取最佳移动
engine.getBestMove(boardState, isRedTurn, (move) => {
    if (move) {
        console.log('最佳移动:', move);
    }
});
```

## 集成外部引擎

### 方法1：集成WebAssembly引擎（如皮卡鱼）

1. **准备WebAssembly模块**
   - 将皮卡鱼引擎编译为WebAssembly格式
   - 确保模块导出必要的函数

2. **创建适配器**

```javascript
// 在 external-engines.js 中添加
class PikafishWasmAdapter {
    constructor() {
        this.module = null;
        this.difficulty = 2;
    }

    async init() {
        // 加载WebAssembly模块
        const wasmModule = await import('./pikafish.wasm');
        this.module = wasmModule;
    }

    getBestMove(boardState, isRedTurn, difficulty) {
        // 将棋盘状态转换为引擎格式
        const position = this.convertBoardToPosition(boardState);
        
        // 调用引擎获取最佳移动
        const uciMove = this.module.getBestMove(position, difficulty);
        
        // 转换回游戏格式
        return this.convertUciToMove(uciMove);
    }
}

// 注册引擎
const pikafishEngine = new ExternalAIEngine({
    onDifficultyChange: (level) => {
        adapter.difficulty = level;
    },
    getBestMove: async (boardState, isRedTurn, difficulty, callback) => {
        const adapter = new PikafishWasmAdapter();
        await adapter.init();
        const move = await adapter.getBestMove(boardState, isRedTurn, difficulty);
        callback(move);
    }
});

aiEngineManager.registerEngine('pikafish', pikafishEngine);
```

3. **在HTML中添加选项**

```html
<select id="ai-engine">
    <option value="builtin">内置引擎</option>
    <option value="builtin-enhanced">增强内置引擎</option>
    <option value="pikafish">皮卡鱼引擎</option>
</select>
```

### 方法2：集成在线API引擎

```javascript
// 创建API适配器
const apiEngine = new ExternalAIEngine({
    getBestMove: async (boardState, isRedTurn, difficulty, callback) => {
        try {
            const response = await fetch('https://your-api.com/xiangqi/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    board: boardState,
                    turn: isRedTurn ? 'red' : 'black',
                    difficulty: difficulty
                })
            });
            
            const data = await response.json();
            callback(data.move); // {fromRow, fromCol, toRow, toCol}
        } catch (error) {
            console.error('API error:', error);
            callback(null);
        }
    }
});

aiEngineManager.registerEngine('online-api', apiEngine);
```

### 方法3：集成本地引擎（通过Web Worker）

```javascript
// 创建Worker适配器
class WorkerEngineAdapter {
    constructor(workerUrl) {
        this.worker = new Worker(workerUrl);
        this.difficulty = 2;
    }

    getBestMove(boardState, isRedTurn, difficulty, callback) {
        this.worker.postMessage({
            type: 'getBestMove',
            boardState: boardState,
            isRedTurn: isRedTurn,
            difficulty: difficulty
        });

        this.worker.onmessage = (e) => {
            if (e.data.type === 'bestMove') {
                callback(e.data.move);
            }
        };
    }
}
```

## 实现自定义引擎

要实现自定义引擎，需要创建一个实现 `AIEngineInterface` 接口的类：

```javascript
class MyCustomEngine extends AIEngineInterface {
    constructor() {
        super();
        this.difficulty = 2;
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    getBestMove(boardState, isRedTurn, callback) {
        // 实现你的AI算法
        const move = this.calculateBestMove(boardState, isRedTurn);
        callback(move);
    }

    reset() {
        // 重置引擎状态
    }

    cleanup() {
        // 清理资源
    }
}

// 注册引擎
const myEngine = new MyCustomEngine();
aiEngineManager.registerEngine('my-engine', myEngine);
```

## 棋盘状态格式

棋盘状态是一个10x9的二维数组，其中：
- `'.'` 表示空位
- 大写字母表示红方棋子：`R`(车), `N`(马), `B`(相), `A`(仕), `K`(帅), `C`(炮), `P`(兵)
- 小写字母表示黑方棋子：`r`(车), `n`(马), `b`(象), `a`(士), `k`(将), `c`(炮), `p`(卒)

示例：
```javascript
const boardState = [
    ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'], // 第0行（黑方底线）
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'], // 第1行
    // ... 更多行
    ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R']  // 第9行（红方底线）
];
```

## 移动格式

移动对象格式：
```javascript
{
    fromRow: 6,  // 起始行 (0-9)
    fromCol: 4,  // 起始列 (0-8)
    toRow: 5,    // 目标行 (0-9)
    toCol: 4     // 目标列 (0-8)
}
```

## 注意事项

1. **异步处理**：`getBestMove` 方法使用回调函数，确保AI计算不会阻塞UI
2. **错误处理**：如果无法计算最佳移动，应调用 `callback(null)`
3. **性能优化**：对于计算密集型的引擎，建议使用Web Worker
4. **状态管理**：引擎应该能够处理棋盘状态的恢复和重置

## 未来计划

- [ ] 完善Web Worker支持
- [ ] 添加更多内置引擎变体
- [ ] 支持引擎性能统计
- [ ] 添加引擎配置选项
- [ ] 支持引擎插件系统

## 参考资源

- [皮卡鱼项目](https://github.com/official-pikafish/Pikafish) - 开源象棋引擎
- [UCI协议](http://wbec-ridderkerk.nl/html/UCIProtocol.html) - 通用象棋接口协议
- [WebAssembly](https://webassembly.org/) - 用于运行高性能引擎

## 贡献

欢迎提交PR来添加新的AI引擎或改进现有系统！
