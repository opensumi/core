# AcpTerminalHandler 重构设计文档

## 背景

`AcpTerminalHandler` 位于 `packages/ai-native/src/node/acp/handlers/terminal.handler.ts`，是为 CLI Agent 提供终端执行能力的核心组件。

### 当前问题

`AcpTerminalHandler` 依赖了 `@opensumi/ide-terminal-next` 前端模块：

```typescript
import { ITerminalConnection, ITerminalService } from '@opensumi/ide-terminal-next';

@Injectable()
export class AcpTerminalHandler {
  @Autowired(ITerminalService)
  private terminalService: ITerminalService;
  // ...
}
```

**架构问题：**

- `@opensumi/ide-terminal-next` 是 Browser/Node 混合模块，主要为前端终端 UI 提供服务
- `AcpTerminalHandler` 位于纯 Node 层（`src/node/`），依赖前端模块造成不必要的耦合
- 在某些部署场景（如纯服务端模式）下，可能不需要加载完整的 terminal-next 模块

## 重构目标

1. **移除依赖**：移除 `AcpTerminalHandler` 对 `@opensumi/ide-terminal-next` 的依赖
2. **保持功能**：保持现有终端功能不降级（支持 PTY、交互式命令）
3. **最小改动**：保持现有接口和使用方式不变，只改内部实现

---

## 设计方案

### 方案概述

使用 `node-pty` 直接替代 `ITerminalService`，在 Node 层直接管理 PTY 进程。

```
重构前：
AcpTerminalHandler → ITerminalService → node-pty

重构后：
AcpTerminalHandler → node-pty（直接使用）
```

### 依赖变更

在 `packages/ai-native/package.json` 中添加：

```json
{
  "dependencies": {
    "node-pty": "1.0.0"
  }
}
```

### 核心改动

#### 1. 导入变更

```typescript
// 移除
import { ITerminalConnection, ITerminalService } from '@opensumi/ide-terminal-next';

// 新增
import * as pty from 'node-pty';
```

#### 2. TerminalSession 接口调整

```typescript
// 移除 ITerminalConnection 依赖
interface TerminalSession {
  terminalId: string;
  sessionId: string;
  // connection: ITerminalConnection;  // 移除
  ptyProcess: pty.IPty; // 新增
  outputBuffer: string;
  outputByteLimit: number;
  exited: boolean;
  exitCode?: number;
  killed: boolean;
  startTime: number;
}
```

#### 3. createTerminal 方法重构

```typescript
// 旧实现
async createTerminal(request: TerminalRequest): Promise<TerminalResponse> {
  const terminalId = uuid();

  // 权限检查...

  const connection = await this.terminalService.createConnection(
    {
      name: `ACP Terminal ${terminalId.substring(0, 8)}`,
      cwd: request.cwd,
      executable: request.command,
      args: request.args,
      env,
    },
    terminalId,
  );

  connection.onData((data) => { ... });
  connection.onExit((code) => { ... });

  // ...
}

// 新实现
async createTerminal(request: TerminalRequest): Promise<TerminalResponse> {
  const terminalId = uuid();

  // 权限检查...

  // 合并环境变量
  const env = {
    ...process.env,
    ...request.env,
  };

  // 使用 node-pty 直接创建 PTY 进程
  const ptyProcess = pty.spawn(request.command, request.args || [], {
    name: 'xterm-256color',
    cwd: request.cwd || process.cwd(),
    env,
    cols: 80,  // 默认值，ACP 场景可能不需要调整
    rows: 24,
  });

  const terminalSession: TerminalSession = {
    terminalId,
    sessionId: request.sessionId,
    ptyProcess,
    outputBuffer: '',
    outputByteLimit: request.outputByteLimit ?? this.defaultOutputLimit,
    exited: false,
    killed: false,
    startTime: Date.now(),
  };

  // 监听输出
  ptyProcess.onData((data) => {
    if (!terminalSession.killed) {
      terminalSession.outputBuffer += data;

      // 滑动窗口截断
      const bufferSize = Buffer.byteLength(terminalSession.outputBuffer, 'utf8');
      if (bufferSize > terminalSession.outputByteLimit) {
        const keepSize = Math.floor(terminalSession.outputByteLimit * 0.8);
        terminalSession.outputBuffer = terminalSession.outputBuffer.slice(-keepSize);
      }
    }
  });

  // 监听退出
  ptyProcess.onExit((code) => {
    terminalSession.exited = true;
    terminalSession.exitCode = code;
    this.logger?.log(`Terminal ${terminalId} exited with code ${code}`);
  });

  this.terminals.set(terminalId, terminalSession);

  return { terminalId };
}
```

#### 4. killTerminal 方法调整

```typescript
// 旧实现
connection.dispose(); // ITerminalConnection 的方法

// 新实现
ptyProcess.kill(); // node-pty 的方法
```

#### 5. releaseTerminal 方法调整

```typescript
// 新增：显式释放 PTY 资源
const session = this.terminals.get(terminalId);
if (session && !session.exited) {
  session.ptyProcess.kill();
}
this.terminals.delete(terminalId);
```

---

## 接口兼容性

### 保持不变的接口

以下接口保持完全兼容，调用方无需修改：

| 方法                                 | 说明                    |
| ------------------------------------ | ----------------------- |
| `createTerminal(request)`            | 创建终端并执行命令      |
| `getTerminalOutput(request)`         | 获取终端输出缓冲        |
| `waitForTerminalExit(request)`       | 等待终端退出（带超时）  |
| `killTerminal(request)`              | 强制终止终端            |
| `releaseTerminal(request)`           | 释放终端资源            |
| `releaseSessionTerminals(sessionId)` | 批量释放 Session 的终端 |
| `setPermissionCallback(callback)`    | 设置权限回调            |
| `configure(options)`                 | 配置选项                |

### 内部实现变更

| 变更点   | 旧实现                                | 新实现                |
| -------- | ------------------------------------- | --------------------- |
| PTY 创建 | `ITerminalService.createConnection()` | `node-pty.spawn()`    |
| 输出监听 | `connection.onData()`                 | `ptyProcess.onData()` |
| 退出监听 | `connection.onExit()`                 | `ptyProcess.onExit()` |
| 终止进程 | `connection.dispose()`                | `ptyProcess.kill()`   |

---

## 风险与缓解

### 风险 1：node-pty 是 native 模块

**问题**：`node-pty` 需要编译原生代码，可能在某些平台上有兼容性问题。

**缓解措施**：

- `node-pty` 是成熟稳定的库，VS Code、OpenSumi terminal-next 都在使用
- OpenSumi 已经在 `@opensumi/ide-terminal-next` 中依赖了 `node-pty@1.0.0`
- 支持 Windows、macOS、Linux 主流平台

### 风险 2：环境变量处理差异

**问题**：`ITerminalService` 有复杂的环境变量处理逻辑（如 shell 集成）。

**缓解措施**：

- ACP 场景不需要 shell 集成等高级功能
- 直接继承 `process.env` 并合并用户传入的环境变量
- 保持与现有逻辑一致

### 风险 3：终端尺寸问题

**问题**：`node-pty.spawn()` 需要 `cols` 和 `rows` 参数。

**缓解措施**：

- 使用默认值（80x24），符合标准终端尺寸
- ACP 场景主要用于命令执行，不涉及前端 UI 展示
- 后续可根据需要添加动态调整支持

---

## 测试计划

### 单元测试

1. **createTerminal**：验证 PTY 进程创建成功
2. **getTerminalOutput**：验证输出缓冲正确
3. **waitForTerminalExit**：验证等待退出逻辑
4. **killTerminal**：验证强制终止逻辑
5. **releaseTerminal**：验证资源释放逻辑
6. **权限回调**：验证权限被拒绝时不创建终端

### 集成测试

1. 执行简单命令（`echo "hello"`）
2. 执行交互式命令（如需要）
3. 验证超时处理
4. 验证并发多个终端

---

## 实施步骤

1. **准备阶段**

   - [ ] 在 `package.json` 中添加 `node-pty` 依赖
   - [ ] 运行 `yarn install`

2. **代码修改**

   - [ ] 修改导入语句
   - [ ] 修改 `TerminalSession` 接口
   - [ ] 重构 `createTerminal` 方法
   - [ ] 重构 `killTerminal` 方法
   - [ ] 重构 `releaseTerminal` 方法

3. **验证阶段**

   - [ ] 编译检查通过
   - [ ] 运行单元测试
   - [ ] 手动验证 ACP 功能

4. **清理阶段**
   - [ ] 移除对 `@opensumi/ide-terminal-next` 的导入
   - [ ] 检查是否还有其他文件依赖

---

## 参考文档

- [node-pty GitHub](https://github.com/microsoft/node-pty)
- [OpenSumi terminal-next 实现](../packages/terminal-next/src/node/pty.ts)
- [VS Code Terminal Process](https://github.com/microsoft/vscode/blob/main/src/vs/platform/terminal/node/terminalProcess.ts)

---

## 变更记录

| 日期       | 版本 | 变更内容 | 作者 |
| ---------- | ---- | -------- | ---- |
| 2026-03-18 | v1.0 | 初始版本 | -    |
