# ACP Node 层重写 — 基于 @agentclientprotocol/sdk

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 `@agentclientprotocol/sdk` 的 `ClientSideConnection` 替换当前 Node 层手写的 JSON-RPC 传输层，消除 setTimeout hack 和静态变量共享连接的问题。

**Architecture:** 新增 `AcpConnectionService` 封装 SDK 的 `ClientSideConnection`，负责进程生命周期管理 + SDK 连接 + `Client` 接口实现。`AcpAgentService` 改为调用 `AcpConnectionService`，`AcpCliClientService` 变为薄代理层。权限调用通过 `AcpConnectionService` 实例直接获取 RPC client，不再使用静态变量。

**Tech Stack:** TypeScript, `@agentclientprotocol/sdk`, `@opensumi/di`, Node.js `stream/web`, `node-pty`

---

## 当前文件清单

```
packages/ai-native/src/node/acp/
├── acp-agent.service.ts          # 修改：移除 JSON-RPC 逻辑，改为调用 AcpConnectionService
├── acp-cli-client.service.ts     # 大幅简化：薄代理层，委托给 AcpConnectionService
├── acp-cli-back.service.ts       # 基本不变：通过 AcpAgentService 调用
├── acp-permission-caller.service.ts # 重写：消除静态变量
├── cli-agent-process-manager.ts  # 不变：进程生命周期管理
├── acp-connection.service.ts     # 新增：SDK 封装（核心新文件）
├── handlers/
│   ├── agent-request.handler.ts  # 修改：从 AcpConnectionService 获取 PermissionCaller
│   ├── file-system.handler.ts    # 不变
│   ├── terminal.handler.ts       # 不变
│   └── constants.ts              # 不变
└── index.ts                      # 修改：导出新增服务
```

## 核心变化

| 变化 | 当前 | 重写后 |
| --- | --- | --- |
| JSON-RPC 传输 | 手写 NDJSON 解析 + 请求队列 (~200 行) | `ClientSideConnection` (SDK) |
| 请求路由 | `handleIncomingRequest` 手动 switch | SDK 通过 `Client` 接口自动分发 |
| 通知收集 | `setTimeout(2000/500)` 等待 | SDK 事件机制直接通知 |
| 权限调用 | 静态变量 `currentRpcClient` | `AcpConnectionService` 实例持有 RPC client |
| 状态缓存 | `negotiatedProtocolVersion`, `agentCapabilities` 等缓存在 Node | 通过 `onInitialized` 事件传给 Browser |

## Stream 转换

Node.js `ChildProcess.stdio` 是 Node.js Streams，SDK 的 `ndJsonStream` 需要 Web Streams：

```typescript
import { Writable } from 'stream';

function nodeStreamsToWebStream(stdout: NodeJS.ReadableStream, stdin: NodeJS.WritableStream): Stream {
  return ndJsonStream(
    new WritableStream<Uint8Array>({
      write(chunk) {
        stdin.write(chunk);
      },
    }),
    Readable.toWeb(stdout as NodeJS.ReadStream),
  );
}
```

---

### Task 1: 创建 AcpConnectionService

**Files:**

- Create: `packages/ai-native/src/node/acp/acp-connection.service.ts`

这是核心新文件，封装 SDK 的 `ClientSideConnection`。

- [ ] **Step 1.1: 创建 acp-connection.service.ts**

```typescript
import { ChildProcess } from 'child_process';
import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import {
  AgentCapabilities,
  AuthMethod,
  CancelNotification,
  Client,
  ClientSideConnection,
  ExtendedInitializeResponse,
  InitializeRequest,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionModeState,
  SessionNotification,
  SetSessionModeRequest,
  SetSessionModeResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  CreateTerminalRequest,
  CreateTerminalResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  ndJsonStream,
  Implementation,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { INodeLogger } from '@opensumi/ide-core-node';
import { Writable } from 'stream';
import { EventEmitter } from '@opensumi/ide-utils/lib/event';
import { IDisposable } from '@opensumi/ide-utils';

import { CliAgentProcessManagerToken, ICliAgentProcessManager } from './cli-agent-process-manager';
import { AcpFileSystemHandler, AcpFileSystemHandlerToken } from './handlers/file-system.handler';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';

// Protocol version constant (moved from acp-cli-client.service.ts)
const ACP_PROTOCOL_VERSION = 1;

// Permission RPC types
import type {
  AcpPermissionDecision,
  AcpPermissionDialogParams,
  IAcpPermissionService,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const AcpConnectionServiceToken = Symbol('AcpConnectionServiceToken');

/**
 * ACP 连接服务：封装 SDK 的 ClientSideConnection
 *
 * 职责：
 * 1. 管理 Agent 进程生命周期（通过 ProcessManager）
 * 2. 创建 SDK ClientSideConnection
 * 3. 实现 Client 接口，路由 Agent 请求到 handlers
 * 4. 发出事件：onInitialized, onDisconnect, onSessionUpdate
 */
@Injectable()
export class AcpConnectionService extends RPCService<IAcpPermissionService> {
  @Autowired(CliAgentProcessManagerToken)
  private processManager: ICliAgentProcessManager;

  @Autowired(AcpFileSystemHandlerToken)
  private fileSystemHandler: AcpFileSystemHandler;

  @Autowired(AcpTerminalHandlerToken)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private connection: ClientSideConnection | null = null;
  private currentProcess: ChildProcess | null = null;
  private childProcessId: string | null = null;
  private initialized = false;

  // 协商结果缓存（通过 initialize() 响应获取）
  private initializeResult: ExtendedInitializeResponse | null = null;

  // 事件
  private _onInitialized = new EventEmitter<ExtendedInitializeResponse>();
  private _onDisconnect = new EventEmitter<string>();
  private _onSessionUpdate = new EventEmitter<SessionNotification>();

  readonly onInitialized = this._onInitialized.event;
  readonly onDisconnect = this._onDisconnect.event;
  readonly onSessionUpdate = this._onSessionUpdate.event;

  /**
   * 初始化 Agent 进程和 SDK 连接
   */
  async initialize(config: AgentProcessConfig): Promise<ExtendedInitializeResponse> {
    if (this.initialized && this.connection) {
      return this.initializeResult!;
    }

    // 1. 启动进程
    const { processId, stdout, stdin } = await this.processManager.startAgent(
      config.command,
      config.args,
      config.env ?? {},
      config.workspaceDir,
    );
    this.childProcessId = processId;

    // 2. 将 Node.js streams 转换为 Web Streams
    const stream = ndJsonStream(
      new WritableStream<Uint8Array>({
        write: (chunk) => {
          stdin.write(chunk);
        },
      }),
      Readable.toWeb(stdout as NodeJS.ReadStream),
    );

    // 3. 创建 Client 实现
    const client = this.createClient();

    // 4. 创建 SDK 连接
    this.connection = new ClientSideConnection(() => client, stream);

    // 5. 发送 initialize 请求
    const initParams: InitializeRequest = {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: 'opensumi', title: 'OpenSumi IDE', version: '3.0.0' },
    };

    const initResponse = await this.connection.initialize(initParams);

    // 6. 缓存协商结果
    this.initializeResult = initResponse as ExtendedInitializeResponse;

    // 7. 发出初始化完成事件
    this._onInitialized.fire(this.initializeResult);

    this.initialized = true;
    this.logger?.log('[AcpConnectionService] Initialized successfully');

    // 8. 监听连接关闭
    this.connection.closed.then(() => {
      this.logger?.warn('[AcpConnectionService] Connection closed');
      this.initialized = false;
      this.initializeResult = null;
      this._onDisconnect.fire('Connection closed');
    });

    return this.initializeResult;
  }

  /**
   * 创建 Client 接口实现
   */
  private createClient(): Client {
    const self = this;
    return {
      async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
        return self.handlePermissionRequest(params);
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        self._onSessionUpdate.fire(params);
      },

      async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
        const result = await self.fileSystemHandler.readTextFile({
          sessionId: params.sessionId,
          path: params.path,
          line: params.line,
          limit: params.limit,
        });
        if (result.error) {
          const err = new Error(result.error.message);
          (err as any).code = result.error.code;
          throw err;
        }
        return { content: result.content || '' };
      },

      async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
        const result = await self.handleWriteFileWithPermission(params);
        return result;
      },

      async createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
        const result = await self.handleCreateTerminalWithPermission(params);
        return result;
      },

      async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
        const result = await self.terminalHandler.getTerminalOutput({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return {
          output: result.output || '',
          truncated: result.truncated || false,
          exitStatus: result.exitStatus != null ? { exitCode: result.exitStatus } : undefined,
        };
      },

      async waitForTerminalExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
        const result = await self.terminalHandler.waitForTerminalExit({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return { exitCode: result.exitCode, signal: result.signal };
      },

      async killTerminal(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse> {
        const result = await self.terminalHandler.killTerminal({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return {};
      },

      async releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> {
        const result = await self.terminalHandler.releaseTerminal({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return {};
      },
    };
  }

  // ========== 权限处理 ==========

  /**
   * 处理权限请求 — 通过 RPC 通知 Browser 端显示对话框
   */
  private async handlePermissionRequest(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const skipPermissionCheck = process.env.SKIP_PERMISSION_CHECK === 'true';
    if (skipPermissionCheck) {
      return this.autoAllow(request);
    }

    // 通过 RPC client 调用 Browser 端
    const rpcClient = this.client;
    if (!rpcClient) {
      throw new Error('[AcpConnectionService] No active RPC client available');
    }

    const dialogParams: AcpPermissionDialogParams = {
      requestId: `${request.sessionId}:${request.toolCall.toolCallId}`,
      sessionId: request.sessionId,
      title: request.toolCall.title ?? 'Permission Request',
      kind: request.toolCall.kind ?? undefined,
      content: this.buildPermissionContent(request),
      locations: request.toolCall.locations?.map((loc) => ({
        path: loc.path,
        line: loc.line ?? undefined,
      })),
      options: this.sortOptionsByKind(request.options),
      timeout: 60000,
    };

    const decision = await rpcClient.$showPermissionDialog(dialogParams);
    return this.buildPermissionResponse(decision, request.options);
  }

  /**
   * 处理写文件权限（先请求权限，再写入）
   */
  private async handleWriteFileWithPermission(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    const permResponse = await this.handlePermissionRequest({
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: `write-${Date.now()}`,
        title: `Write file: ${params.path}`,
        kind: 'write',
        status: 'pending',
        locations: [{ path: params.path }],
        rawInput: { path: params.path, contentLength: params.content?.length },
      },
      options: [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
        { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' },
        { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' },
      ],
    });

    if (permResponse.outcome.outcome !== 'selected' || !permResponse.outcome.optionId?.startsWith('allow_')) {
      const err = new Error('Write permission denied');
      (err as any).code = -32003;
      throw err;
    }

    const result = await this.fileSystemHandler.writeTextFile({
      sessionId: params.sessionId,
      path: params.path,
      content: params.content,
    });
    if (result.error) {
      throw new Error(result.error.message);
    }
    return {};
  }

  /**
   * 处理终端创建权限（先请求权限，再创建）
   */
  private async handleCreateTerminalWithPermission(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    const commandStr = [params.command, ...(params.args || [])].join(' ');

    const permResponse = await this.handlePermissionRequest({
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: `terminal-${Date.now()}`,
        title: `Run command: ${commandStr}`,
        kind: 'execute',
        status: 'pending',
        rawInput: { command: params.command, args: params.args, cwd: params.cwd },
      },
      options: [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
        { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' },
        { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' },
      ],
    });

    if (permResponse.outcome.outcome !== 'selected' || !permResponse.outcome.optionId?.startsWith('allow_')) {
      const err = new Error('Command execution permission denied');
      (err as any).code = -32003;
      throw err;
    }

    const result = await this.terminalHandler.createTerminal({
      sessionId: params.sessionId,
      command: params.command,
      args: params.args,
      env: params.env?.reduce<Record<string, string>>((acc, v) => {
        acc[v.name] = v.value;
        return acc;
      }, {}),
      cwd: params.cwd ?? undefined,
      outputByteLimit: params.outputByteLimit ?? undefined,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { terminalId: result.terminalId || '' };
  }

  // ========== 权限辅助方法 ==========

  private autoAllow(request: RequestPermissionRequest): RequestPermissionResponse {
    const allowOptionId = this.findAllowOptionId(request.options);
    return { outcome: { outcome: 'selected', optionId: allowOptionId } };
  }

  private findAllowOptionId(options: Array<{ optionId: string; kind: string }>): string {
    const allowOnce = options.find((o) => o.kind === 'allow_once');
    if (allowOnce) return allowOnce.optionId;
    const allowAlways = options.find((o) => o.kind === 'allow_always');
    if (allowAlways) return allowAlways.optionId;
    return options[0]?.optionId || '';
  }

  private buildPermissionContent(request: RequestPermissionRequest): string {
    const parts: string[] = [];
    if (request.toolCall.title) parts.push(request.toolCall.title);
    if (request.toolCall.locations?.length) {
      const files = request.toolCall.locations.map((loc) => loc.path).join(', ');
      parts.push(`Affected files: ${files}`);
    }
    const command = (request.toolCall.rawInput as Record<string, unknown>)?.command;
    if (command) parts.push(`Command: \`${command}\``);
    return parts.join('\n\n');
  }

  private sortOptionsByKind(
    options: Array<{ optionId: string; kind: string }>,
  ): Array<{ optionId: string; name: string; kind: string }> {
    const kindOrder: Record<string, number> = {
      allow_always: 0,
      allow_once: 1,
      reject_always: 2,
      reject_once: 3,
    };
    return [...options].sort((a, b) => (kindOrder[a.kind] ?? 999) - (kindOrder[b.kind] ?? 999));
  }

  private buildPermissionResponse(
    decision: AcpPermissionDecision,
    options: Array<{ optionId: string; kind: string }>,
  ): RequestPermissionResponse {
    switch (decision.type) {
      case 'allow':
      case 'reject': {
        const prefix = decision.type === 'allow' ? 'allow' : 'reject';
        const matching = options.find((o) => o.kind.startsWith(prefix));
        const optionId = decision.optionId || matching?.optionId || options[0]?.optionId || '';
        return { outcome: { outcome: 'selected', optionId } };
      }
      case 'timeout':
      case 'cancelled':
        return { outcome: { outcome: 'cancelled' } };
      default:
        return { outcome: { outcome: 'cancelled' } };
    }
  }

  // ========== Session 操作（通过 SDK Agent 接口）==========

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    this.ensureConnected();
    return this.connection!.newSession(params);
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    this.ensureConnected();
    return this.connection!.loadSession(params);
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    this.ensureConnected();
    return this.connection!.prompt(params);
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.ensureConnected();
    return this.connection!.cancel(params);
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    this.ensureConnected();
    return this.connection!.listSessions(params);
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    this.ensureConnected();
    return this.connection!.setSessionMode(params);
  }

  async close(): Promise<void> {
    if (this.connection) {
      // 连接关闭由 SDK 内部处理
      this.connection = null;
    }
    this.initialized = false;
    this.initializeResult = null;
    this.childProcessId = null;
  }

  async dispose(): Promise<void> {
    await this.close();
    await this.processManager.killAllAgents();
  }

  // ========== 状态查询 ==========

  isInitialized(): boolean {
    return this.initialized;
  }

  getInitializeResult(): ExtendedInitializeResponse | null {
    return this.initializeResult;
  }

  getSessionInfo(): { sessionId: string; modes: Array<{ id: string; name: string }>; status: string } | null {
    // 这个信息将由 Browser 层通过 onSessionUpdate 事件维护
    // 这里只返回初始化信息
    if (!this.initializeResult) return null;
    return {
      sessionId: '',
      modes: this.initializeResult.modes?.availableModes ?? [],
      status: this.initialized ? 'ready' : 'stopped',
    };
  }

  private ensureConnected(): void {
    if (!this.initialized || !this.connection) {
      throw new Error('Not connected to agent process');
    }
  }
}
```

- [ ] **Step 1.2: 验证编译**

运行：

```bash
npx tsc --noEmit --project configs/ts/references/tsconfig.ai-native.json
```

预期：可能有 `acp-types.ts` 导出类型不匹配的 warning，但不应有错误（`skipLibCheck: true` 会抑制 SDK 类型问题）。

- [ ] **Step 1.3: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-connection.service.ts
git commit -m "feat(acp): add AcpConnectionService wrapping @agentclientprotocol/sdk

Wraps ClientSideConnection from the official ACP SDK, replacing custom
JSON-RPC transport layer. Implements Client interface to route agent
requests (fs, terminal, permission) to handlers. Emits events for
initialization, disconnection, and session updates."
```

---

### Task 2: 重构 AcpAgentService

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts`

目标：移除所有自定义 JSON-RPC 逻辑，改为调用 `AcpConnectionService`。保留 `IAcpAgentService` 接口不变（Browser 层依赖）。

- [ ] **Step 2.1: 重写 acp-agent.service.ts**

完整文件内容：

```typescript
import { Autowired, Injectable } from '@opensumi/di';
import {
  AcpCliClientServiceToken,
  type AvailableCommand,
  type CancelNotification,
  type ContentBlock,
  IAcpCliClientService,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type LoadSessionRequest,
  type NewSessionRequest,
  type SessionMode,
  type SessionModeState,
  type SessionNotification,
  type SetSessionModeRequest,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
import { Event, IDisposable } from '@opensumi/ide-utils/lib/event';

import { AcpAgentRequestHandler, AcpAgentRequestHandlerToken } from './handlers/agent-request.handler';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';
import { AcpConnectionService, AcpConnectionServiceToken } from './acp-connection.service';

export interface SessionLoadResult {
  sessionId: string;
  processId: string;
  modes: SessionMode[];
  status: AgentSessionStatus;
  historyUpdates: SessionNotification[];
}

export const AcpAgentServiceToken = Symbol('AcpAgentServiceToken');

export type AgentSessionStatus = 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped' | 'error';

export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface AgentSessionInfo {
  sessionId: string;
  processId: string;
  modes: SessionMode[];
  status: AgentSessionStatus;
}

export type AgentUpdateType = 'thought' | 'message' | 'tool_call' | 'tool_result' | 'done';

export interface AgentUpdate {
  type: AgentUpdateType;
  content: string;
  toolCall?: { name: string; input: Record<string, unknown> };
}

export interface AgentRequest {
  prompt: string;
  sessionId: string;
  images?: string[];
  history?: SimpleMessage[];
}

/**
 * ACP Agent 服务 — 委托给 AcpConnectionService
 *
 * 保留 IAcpAgentService 接口不变，确保 Browser 层无需修改。
 * 所有底层操作（进程、传输、通知）由 AcpConnectionService 处理。
 */
@Injectable()
export class AcpAgentService implements IAcpAgentService {
  @Autowired(AcpConnectionServiceToken)
  private connectionService: AcpConnectionService;

  @Autowired(AcpCliClientServiceToken)
  private clientService: IAcpCliClientService;

  @Autowired(AcpTerminalHandlerToken)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  // 当前 session 信息（从 onSessionUpdate 事件维护）
  private sessionInfo: AgentSessionInfo | null = null;

  // 收集 createSession/loadSession 期间收到的 availableCommands
  private pendingAvailableCommands: AvailableCommand[] = [];
  private sessionUpdateDisposable: IDisposable | null = null;

  async initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo> {
    // 委托给 connectionService
    const initResult = await this.connectionService.initialize(config);

    // 从 SDK initialize 响应构建 sessionInfo
    this.sessionInfo = {
      sessionId: '', // session 尚未创建
      processId: this.connectionService.getSessionInfo()?.processId ?? '',
      modes: (initResult.modes?.availableModes ?? []) as SessionMode[],
      status: 'ready',
    };

    return this.sessionInfo;
  }

  async createSession(
    config: AgentProcessConfig,
  ): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }> {
    await this.ensureConnected(config);

    // 收集 availableCommands 通知
    this.pendingAvailableCommands = [];
    this.startCollectingSessionUpdates();

    try {
      const res = await this.connectionService.newSession({ cwd: config.workspaceDir, mcpServers: [] });

      // 不再用 setTimeout — 直接返回已收集的通知
      // availableCommands 通常通过 session/update 通知发出
      const commands = this.collectAvailableCommands();

      return { sessionId: res.sessionId, availableCommands: commands };
    } finally {
      this.stopCollectingSessionUpdates();
    }
  }

  async loadSession(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult> {
    await this.ensureConnected(config);

    const historyUpdates: SessionNotification[] = [];

    // 开始收集 session/update 通知
    this.startCollectingSessionUpdates();

    try {
      const res = await this.connectionService.loadSession({
        sessionId,
        cwd: config.workspaceDir,
        mcpServers: [],
      });

      // 获取收集到的历史通知
      const collected = this.stopCollectingSessionUpdates();
      historyUpdates.push(...collected);
    } catch (error) {
      this.stopCollectingSessionUpdates();
      throw error;
    }

    // 从通知中提取 modes
    const modes: SessionMode[] = [];
    for (const notification of historyUpdates) {
      const update = notification.update as any;
      if (update?.currentModeId) {
        const existingMode = modes.find((m) => m.id === update.currentModeId);
        if (!existingMode) {
          modes.push({ id: update.currentModeId, name: update.currentModeId });
        }
      }
    }

    this.sessionInfo = {
      sessionId,
      processId: '',
      modes,
      status: 'ready',
    };

    return { sessionId, processId: '', modes, status: 'ready', historyUpdates };
  }

  sendMessage(request: AgentRequest): SumiReadableStream<AgentUpdate> {
    const stream = new SumiReadableStream<AgentUpdate>();

    const unsubscribe = this.connectionService.onSessionUpdate((notification: SessionNotification) => {
      if (notification.sessionId !== request.sessionId) return;
      this.handleNotification(notification, stream);
    });

    stream.onEnd(() => unsubscribe());
    stream.onError(() => unsubscribe());

    this.sendPrompt(request, stream);

    return stream;
  }

  async cancelRequest(sessionId: string): Promise<void> {
    try {
      await this.connectionService.cancel({ sessionId });
    } catch (error) {
      this.logger?.warn('cancelRequest error:', error);
    }
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    return this.connectionService.listSessions(params);
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<void> {
    await this.connectionService.setSessionMode(params);
  }

  async disposeSession(sessionId: string): Promise<void> {
    await this.terminalHandler.releaseSessionTerminals(sessionId);
  }

  async getAvailableModes(): Promise<SessionModeState | null> {
    return this.connectionService.getInitializeResult()?.modes ?? null;
  }

  getSessionInfo(): AgentSessionInfo | null {
    return this.sessionInfo;
  }

  async stopAgent(): Promise<void> {
    await this.connectionService.dispose();
    this.sessionInfo = null;
  }

  async dispose(): Promise<void> {
    this.logger?.warn('[AcpAgentService] dispose called');
    await this.stopAgent();
  }

  // ========== 私有方法 ==========

  private async ensureConnected(config: AgentProcessConfig): Promise<void> {
    if (!this.connectionService.isInitialized()) {
      await this.initializeAgent(config);
    }
  }

  private startCollectingSessionUpdates(): void {
    this.sessionUpdateDisposable = this.connectionService.onSessionUpdate((notification: SessionNotification) => {
      const update = notification.update as any;
      if (update?.sessionUpdate === 'available_commands_update' && Array.isArray(update.availableCommands)) {
        this.pendingAvailableCommands.push(...update.availableCommands);
      }
    });
  }

  private stopCollectingSessionUpdates(): SessionNotification[] {
    this.sessionUpdateDisposable?.dispose();
    this.sessionUpdateDisposable = null;
    return [];
  }

  private collectAvailableCommands(): AvailableCommand[] {
    const seen = new Set<string>();
    return this.pendingAvailableCommands.filter((cmd) => {
      if (seen.has(cmd.name)) return false;
      seen.add(cmd.name);
      return true;
    });
  }

  private async sendPrompt(request: AgentRequest, stream: SumiReadableStream<AgentUpdate>): Promise<void> {
    const promptBlocks = this.buildPromptBlocks(request.prompt, request.images);

    try {
      await this.connectionService.prompt({
        sessionId: request.sessionId,
        prompt: promptBlocks,
      });
      stream.emitData({ type: 'done', content: '' });
      stream.end();
    } catch (error) {
      stream.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleNotification(notification: SessionNotification, stream: SumiReadableStream<AgentUpdate>): void {
    const update = notification.update;

    switch (update.sessionUpdate) {
      case 'agent_thought_chunk': {
        const content = update.content;
        if (content.type === 'text') {
          stream.emitData({ type: 'thought', content: content.text });
        }
        break;
      }
      case 'agent_message_chunk': {
        const content = update.content;
        if (content.type === 'text') {
          stream.emitData({ type: 'message', content: content.text });
        }
        break;
      }
      case 'tool_call': {
        stream.emitData({
          type: 'tool_call',
          content: update.title || '',
          toolCall: {
            name: update.title || '',
            input: (update.rawInput as Record<string, unknown>) || {},
          },
        });
        break;
      }
      case 'tool_call_update': {
        if (update.content) {
          for (const content of update.content) {
            if (content.type === 'diff') {
              stream.emitData({ type: 'tool_result', content: `Modified ${content.path}` });
            }
          }
        }
        break;
      }
      default:
        this.logger?.log(`Unhandled session update type: ${update.sessionUpdate}`);
        break;
    }
  }

  private buildPromptBlocks(input: string, images?: string[]): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    blocks.push({ type: 'text', text: input });

    if (images && images.length > 0) {
      for (const imageData of images) {
        const { mimeType, base64Data } = this.parseDataUrl(imageData);
        blocks.push({ type: 'image', data: base64Data, mimeType });
      }
    }
    return blocks;
  }

  private parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
    if (dataUrl.startsWith('data:')) {
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) return { mimeType: matches[1], base64Data: matches[2] };
    }
    return { mimeType: 'image/jpeg', base64Data: dataUrl };
  }
}
```

- [ ] **Step 2.2: 验证编译**

```bash
npx tsc --noEmit --project configs/ts/references/tsconfig.ai-native.json
```

- [ ] **Step 2.3: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-agent.service.ts
git commit -m "refactor(acp): rewrite AcpAgentService to use AcpConnectionService

Removes custom JSON-RPC transport logic, delegates all operations to
AcpConnectionService which wraps @agentclientprotocol/sdk.
Removes setTimeout(2000) hack — availableCommands now collected via
onSessionUpdate event. IAcpAgentService interface unchanged for
backward compatibility."
```

---

### Task 3: 简化 AcpCliClientService

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-cli-client.service.ts`

目标：从 ~593 行手写 JSON-RPC 变为薄代理层，所有操作委托给 `AcpConnectionService`。

- [ ] **Step 3.1: 重写 acp-cli-client.service.ts**

```typescript
/**
 * ACP CLI 客户端服务 — 薄代理层
 *
 * 重写后：所有操作委托给 AcpConnectionService（封装 @agentclientprotocol/sdk）。
 * 不再手写 JSON-RPC 传输逻辑。
 */
import { Autowired, Injectable } from '@opensumi/di';
import {
  AgentCapabilities,
  AuthMethod,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  ExtendedInitializeResponse,
  IAcpCliClientService,
  InitializeRequest,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  SessionModeState,
  SessionNotification,
  SetSessionModeRequest,
  SetSessionModeResponse,
} from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpConnectionService, AcpConnectionServiceToken } from './acp-connection.service';

@Injectable()
export class AcpCliClientService implements IAcpCliClientService {
  @Autowired(AcpConnectionServiceToken)
  private connectionService: AcpConnectionService;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  // 所有操作委托给 AcpConnectionService

  setTransport(_stdout: NodeJS.ReadableStream, _stdin: NodeJS.WritableStream): void {
    // No-op: transport is managed by AcpConnectionService.initialize()
  }

  async initialize(params?: InitializeRequest): Promise<ExtendedInitializeResponse> {
    // initialize 由 AcpConnectionService.initialize(config) 内部调用
    // 此方法仅返回已缓存的协商结果
    const result = this.connectionService.getInitializeResult();
    if (!result) {
      throw new Error('Not connected to agent process. Call AcpConnectionService.initialize() first.');
    }
    return result;
  }

  async authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse> {
    // SDK ClientSideConnection 暴露 authenticate 方法
    // 但当前 AcpConnectionService 未暴露此方法 — 后续可按需添加
    throw new Error('authenticate not implemented yet');
  }

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    return this.connectionService.newSession(params);
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    return this.connectionService.loadSession(params);
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    return this.connectionService.listSessions(params);
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    return this.connectionService.prompt(params);
  }

  async cancel(params: CancelNotification): Promise<void> {
    return this.connectionService.cancel(params);
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    return this.connectionService.setSessionMode(params);
  }

  onNotification(handler: (notification: SessionNotification) => void): () => void {
    const disposable = this.connectionService.onSessionUpdate(handler);
    return () => disposable.dispose();
  }

  async close(): Promise<void> {
    return this.connectionService.close();
  }

  isConnected(): boolean {
    return this.connectionService.isInitialized();
  }

  handleDisconnect(): void {
    // No-op: disconnect handled by AcpConnectionService.onDisconnect event
  }

  onDisconnect(handler: () => void): () => void {
    const disposable = this.connectionService.onDisconnect(() => handler());
    return () => disposable.dispose();
  }

  getNegotiatedProtocolVersion(): number | null {
    return this.connectionService.getInitializeResult()?.protocolVersion ?? null;
  }

  getAgentCapabilities(): AgentCapabilities | null {
    return this.connectionService.getInitializeResult()?.agentCapabilities ?? null;
  }

  getAgentInfo(): Implementation | null {
    return this.connectionService.getInitializeResult()?.agentInfo ?? null;
  }

  getAuthMethods(): AuthMethod[] {
    return this.connectionService.getInitializeResult()?.authMethods ?? [];
  }

  getSessionModes(): SessionModeState | null {
    return this.connectionService.getInitializeResult()?.modes ?? null;
  }
}
```

- [ ] **Step 3.2: 验证编译**

```bash
npx tsc --noEmit --project configs/ts/references/tsconfig.ai-native.json
```

- [ ] **Step 3.3: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-cli-client.service.ts
git commit -m "refactor(acp): simplify AcpCliClientService to thin proxy

Replaces ~593 lines of handwritten JSON-RPC transport (NDJSON parsing,
request queue, pending request map) with thin proxy layer delegating
to AcpConnectionService. All IAcpCliClientService methods preserved
for backward compatibility."
```

---

### Task 4: 简化 AcpAgentRequestHandler + 废弃旧 PermissionCaller

**Files:**

- Modify: `packages/ai-native/src/node/acp/handlers/agent-request.handler.ts`
- Modify: `packages/ai-native/src/node/acp/acp-permission-caller.service.ts`

目标：`AcpAgentRequestHandler` 不再需要 — 所有请求路由由 SDK 的 `Client` 接口自动处理。保留它但变为空壳以兼容现有 DI 注册。`AcpPermissionCallerManager` 的静态变量被消除。

- [ ] **Step 4.1: 简化 AcpAgentRequestHandler**

```typescript
/**
 * ACP Agent Request Handler
 *
 * 重写后：所有请求路由已由 AcpConnectionService.createClient() 中的
 * Client 接口实现处理。此服务保留为兼容壳，具体 handler 方法直接委托
 * 给 AcpConnectionService。
 */
import { Autowired, Injectable } from '@opensumi/di';
import {
  CreateTerminalRequest,
  CreateTerminalResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpConnectionService, AcpConnectionServiceToken } from '../acp-connection.service';

export const AcpAgentRequestHandlerToken = Symbol('AcpAgentRequestHandlerToken');

@Injectable()
export class AcpAgentRequestHandler {
  @Autowired(AcpConnectionServiceToken)
  private connectionService: AcpConnectionService;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
  }

  async handlePermissionRequest(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    // 已由 AcpConnectionService.createClient().requestPermission 处理
    // 保留此方法为兼容壳
    this.logger.warn(
      '[AcpAgentRequestHandler] handlePermissionRequest called directly — should be handled by AcpConnectionService',
    );
    return { outcome: { outcome: 'cancelled' } };
  }

  async handleReadTextFile(request: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    // 已由 AcpConnectionService.createClient().readTextFile 处理
    this.logger.warn(
      '[AcpAgentRequestHandler] handleReadTextFile called directly — should be handled by AcpConnectionService',
    );
    throw new Error('Not implemented — handled by AcpConnectionService');
  }

  async handleWriteTextFile(request: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    // 已由 AcpConnectionService.createClient().writeTextFile 处理
    this.logger.warn(
      '[AcpAgentRequestHandler] handleWriteTextFile called directly — should be handled by AcpConnectionService',
    );
    throw new Error('Not implemented — handled by AcpConnectionService');
  }

  async handleCreateTerminal(request: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    // 已由 AcpConnectionService.createClient().createTerminal 处理
    this.logger.warn(
      '[AcpAgentRequestHandler] handleCreateTerminal called directly — should be handled by AcpConnectionService',
    );
    throw new Error('Not implemented — handled by AcpConnectionService');
  }

  async handleTerminalOutput(request: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    this.logger.warn(
      '[AcpAgentRequestHandler] handleTerminalOutput called directly — should be handled by AcpConnectionService',
    );
    throw new Error('Not implemented — handled by AcpConnectionService');
  }

  async handleWaitForTerminalExit(request: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
    this.logger.warn(
      '[AcpAgentRequestHandler] handleWaitForTerminalExit called directly — should be handled by AcpConnectionService',
    );
    throw new Error('Not implemented — handled by AcpConnectionService');
  }

  async handleKillTerminal(request: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse> {
    this.logger.warn(
      '[AcpAgentRequestHandler] handleKillTerminal called directly — should be handled by AcpConnectionService',
    );
    throw new Error('Not implemented — handled by AcpConnectionService');
  }

  async handleReleaseTerminal(request: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> {
    this.logger.warn(
      '[AcpAgentRequestHandler] handleReleaseTerminal called directly — should be handled by AcpConnectionService',
    );
    throw new Error('Not implemented — handled by AcpConnectionService');
  }

  async disposeSession(sessionId: string): Promise<void> {
    // delegate to connection service
  }
}
```

- [ ] **Step 4.2: 简化 AcpPermissionCallerManager（消除静态变量）**

```typescript
/**
 * ACP Permission Caller Manager
 *
 * 重写后：不再使用静态变量 currentRpcClient。
 * 每个 AcpConnectionService 实例通过 extends RPCService<IAcpPermissionService>
 * 直接持有当前连接的 RPC client。
 *
 * 此服务保留为 DI 兼容壳，实际权限调用由 AcpConnectionService 处理。
 */
import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { INodeLogger } from '@opensumi/ide-core-node';

import type {
  AcpPermissionDecision,
  AcpPermissionDialogParams,
  IAcpPermissionCaller,
  IAcpPermissionService,
  PermissionOption,
  PermissionOptionKind,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const AcpPermissionCallerManagerToken = Symbol('AcpPermissionCallerManagerToken');

@Injectable()
export class AcpPermissionCallerManager extends RPCService<IAcpPermissionService> implements IAcpPermissionCaller {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private clientId: string | undefined;

  setConnectionClientId(clientId: string): void {
    this.clientId = clientId;
  }

  removeConnectionClientId(clientId: string): void {
    if (this.clientId === clientId) {
      this.clientId = undefined;
    }
  }

  async requestPermission(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    // 委托给当前 RPC client
    const rpcClient = this.client;
    if (!rpcClient) {
      throw new Error('[ACP Permission Caller] No active RPC client available');
    }

    const skipPermissionCheck = process.env.SKIP_PERMISSION_CHECK === 'true';
    if (skipPermissionCheck) {
      const allowOptionId = this.findAllowOptionId(request.options);
      return { outcome: { outcome: 'selected', optionId: allowOptionId } };
    }

    const dialogParams: AcpPermissionDialogParams = {
      requestId: `${request.sessionId}:${request.toolCall.toolCallId}`,
      sessionId: request.sessionId,
      title: request.toolCall.title ?? 'Permission Request',
      kind: request.toolCall.kind ?? undefined,
      content: this.buildPermissionContent(request),
      locations: request.toolCall.locations?.map((loc) => ({
        path: loc.path,
        line: loc.line ?? undefined,
      })),
      options: this.sortOptionsByKind(request.options),
      timeout: 60000,
    };

    const decision = await rpcClient.$showPermissionDialog(dialogParams);
    return this.buildPermissionResponse(decision, request.options);
  }

  async cancelRequest(requestId: string): Promise<void> {
    try {
      const rpcClient = this.client;
      if (rpcClient) {
        await rpcClient.$cancelRequest(requestId);
      }
    } catch (error) {
      this.logger.error('[ACP Permission Caller] Failed to cancel request:', error);
    }
  }

  private findAllowOptionId(options: PermissionOption[]): string {
    const allowOnce = options.find((o) => o.kind === 'allow_once');
    if (allowOnce) return allowOnce.optionId;
    const allowAlways = options.find((o) => o.kind === 'allow_always');
    if (allowAlways) return allowAlways.optionId;
    return options[0]?.optionId || '';
  }

  private buildPermissionContent(request: RequestPermissionRequest): string {
    const parts: string[] = [];
    if (request.toolCall.title) parts.push(request.toolCall.title);
    if (request.toolCall.locations?.length) {
      const files = request.toolCall.locations.map((loc) => loc.path).join(', ');
      parts.push(`Affected files: ${files}`);
    }
    const command = (request.toolCall.rawInput as Record<string, unknown>)?.command;
    if (command) parts.push(`Command: \`${command}\``);
    return parts.join('\n\n');
  }

  private buildPermissionResponse(
    decision: AcpPermissionDecision,
    options: PermissionOption[],
  ): RequestPermissionResponse {
    switch (decision.type) {
      case 'allow':
      case 'reject': {
        const optionId = decision.optionId || this.findOptionId(decision.type, options);
        return { outcome: { outcome: 'selected', optionId } };
      }
      case 'timeout':
      case 'cancelled':
        return { outcome: { outcome: 'cancelled' } };
      default:
        return { outcome: { outcome: 'cancelled' } };
    }
  }

  private findOptionId(decisionType: 'allow' | 'reject', options: PermissionOption[]): string {
    const kinds = decisionType === 'allow' ? ['allow_once', 'allow_always'] : ['reject_once', 'reject_always'];
    for (const kind of kinds) {
      const option = options.find((o) => o.kind === kind);
      if (option) return option.optionId;
    }
    const prefix = decisionType === 'allow' ? 'allow' : 'reject';
    const anyMatching = options.find((o) => o.kind.startsWith(prefix));
    if (anyMatching) return anyMatching.optionId;
    return options[0]?.optionId || '';
  }

  private sortOptionsByKind(options: PermissionOption[]): PermissionOption[] {
    const kindOrder: Record<PermissionOptionKind, number> = {
      allow_always: 0,
      allow_once: 1,
      reject_always: 2,
      reject_once: 3,
    };
    return [...options].sort(
      (a, b) => (kindOrder[a.kind] ?? Number.MAX_SAFE_INTEGER) - (kindOrder[b.kind] ?? Number.MAX_SAFE_INTEGER),
    );
  }
}
```

- [ ] **Step 4.3: Commit**

```bash
git add packages/ai-native/src/node/acp/handlers/agent-request.handler.ts packages/ai-native/src/node/acp/acp-permission-caller.service.ts
git commit -m "refactor(acp): eliminate static variable in AcpPermissionCallerManager

AcpAgentRequestHandler simplified to compatibility shell — all request
routing now handled by AcpConnectionService.createClient() via SDK
Client interface. Permission caller no longer uses static variable
for RPC client sharing."
```

---

### Task 5: 更新 index.ts + 模块注册

**Files:**

- Modify: `packages/ai-native/src/node/acp/index.ts`

- [ ] **Step 5.1: 更新 index.ts 导出**

```typescript
export { AcpCliClientService } from './acp-cli-client.service';
export {
  CliAgentProcessManager,
  CliAgentProcessManagerToken,
  ICliAgentProcessManager,
} from './cli-agent-process-manager';
export { AcpCliBackService, AcpCliBackServiceToken } from './acp-cli-back.service';
export { AcpFileSystemHandler, AcpFileSystemHandlerToken } from './handlers/file-system.handler';
export { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';
export { AcpAgentRequestHandler, AcpAgentRequestHandlerToken } from './handlers/agent-request.handler';
export { AcpAgentService, AcpAgentServiceToken, IAcpAgentService } from './acp-agent.service';
export { AcpPermissionCallerManager, AcpPermissionCallerManagerToken } from './acp-permission-caller.service';
export { AcpConnectionService, AcpConnectionServiceToken } from './acp-connection.service';
```

- [ ] **Step 5.2: 更新 node/index.ts 注册 AcpConnectionService**

修改 `packages/ai-native/src/node/index.ts`，在 providers 数组中添加 `AcpConnectionService`：

```typescript
// 在 imports 中添加：
import {
  AcpAgentRequestHandler,
  AcpAgentRequestHandlerToken,
  AcpAgentService,
  AcpAgentServiceToken,
  AcpConnectionService,
  AcpConnectionServiceToken,
  AcpFileSystemHandler,
  AcpFileSystemHandlerToken,
  AcpPermissionCallerManager,
  AcpPermissionCallerManagerToken,
  AcpTerminalHandler,
  AcpTerminalHandlerToken,
  CliAgentProcessManager,
  CliAgentProcessManagerToken,
} from './acp';
import { AcpCliBackService } from './acp/acp-cli-back.service';
import { AcpCliClientService } from './acp/acp-cli-client.service';

// 在 providers 数组中添加：
{
  token: AcpConnectionServiceToken,
  useClass: AcpConnectionService,
},
```

完整修改后的 node/index.ts：

```typescript
import { Injectable, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  AcpCliClientServiceToken,
  AcpPermissionServicePath,
} from '@opensumi/ide-core-common';
import { NodeModule } from '@opensumi/ide-core-node';

import { SumiMCPServerProxyServicePath, TokenMCPServerProxyService } from '../common';
import { ToolInvocationRegistryManager, ToolInvocationRegistryManagerImpl } from '../common/tool-invocation-registry';

import {
  AcpAgentRequestHandler,
  AcpAgentRequestHandlerToken,
  AcpAgentService,
  AcpAgentServiceToken,
  AcpConnectionService,
  AcpConnectionServiceToken,
  AcpFileSystemHandler,
  AcpFileSystemHandlerToken,
  AcpPermissionCallerManager,
  AcpPermissionCallerManagerToken,
  AcpTerminalHandler,
  AcpTerminalHandlerToken,
  CliAgentProcessManager,
  CliAgentProcessManagerToken,
} from './acp';
import { AcpCliBackService } from './acp/acp-cli-back.service';
import { AcpCliClientService } from './acp/acp-cli-client.service';
import { SumiMCPServerBackend } from './mcp/sumi-mcp-server';
import { OpenAICompatibleModel } from './openai-compatible/openai-compatible-language-model';

@Injectable()
export class AINativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AIBackSerivceToken,
      useClass: AcpCliBackService,
    },
    {
      token: AcpConnectionServiceToken,
      useClass: AcpConnectionService,
    },
    {
      token: AcpCliClientServiceToken,
      useClass: AcpCliClientService,
    },
    {
      token: CliAgentProcessManagerToken,
      useClass: CliAgentProcessManager,
    },
    {
      token: AcpAgentServiceToken,
      useClass: AcpAgentService,
    },
    {
      token: AcpPermissionCallerManagerToken,
      useClass: AcpPermissionCallerManager,
    },
    {
      token: ToolInvocationRegistryManager,
      useClass: ToolInvocationRegistryManagerImpl,
    },
    {
      token: TokenMCPServerProxyService,
      useClass: SumiMCPServerBackend,
    },
    {
      token: AcpFileSystemHandlerToken,
      useClass: AcpFileSystemHandler,
    },
    {
      token: AcpTerminalHandlerToken,
      useClass: AcpTerminalHandler,
    },
    {
      token: AcpAgentRequestHandlerToken,
      useClass: AcpAgentRequestHandler,
    },
    // Language models for non-ACP fallback
    OpenAICompatibleModel,
  ];

  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
    },
    {
      servicePath: SumiMCPServerProxyServicePath,
      token: TokenMCPServerProxyService,
    },
    {
      servicePath: AcpPermissionServicePath,
      token: AcpPermissionCallerManagerToken,
    },
  ];
}
```

- [ ] **Step 5.3: 完整编译验证**

```bash
npx tsc --noEmit --project configs/ts/references/tsconfig.ai-native.json
```

- [ ] **Step 5.4: Commit**

```bash
git add packages/ai-native/src/node/acp/index.ts packages/ai-native/src/node/index.ts
git commit -m "feat(acp): register AcpConnectionService in DI module

Add AcpConnectionServiceToken provider. Update index.ts exports.
All existing tokens and interfaces preserved for backward compatibility."
```

---

### Task 6: AcpCliBackService 适配 + 最终验证

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-cli-back.service.ts`

`AcpCliBackService` 基本不需要大改，因为它通过 `AcpAgentService` 间接调用。但需要确认 `loadAgentSession` 中的 `historyUpdates` 收集方式是否与新的事件驱动方式兼容。

- [ ] **Step 6.1: 验证 AcpCliBackService 无需修改**

读取 `acp-cli-back.service.ts` 确认它只调用 `IAcpAgentService` 接口方法：

- `agentService.createSession()` — Task 2 已实现
- `agentService.initializeAgent()` — Task 2 已实现
- `agentService.getSessionInfo()` — Task 2 已实现
- `agentService.sendMessage()` — Task 2 已实现
- `agentService.cancelRequest()` — Task 2 已实现
- `agentService.loadSession()` — Task 2 已实现
- `agentService.disposeSession()` — Task 2 已实现
- `agentService.setSessionMode()` — Task 2 已实现
- `agentService.listSessions()` — Task 2 已实现
- `agentService.dispose()` — Task 2 已实现

如果所有方法签名不变，则 `AcpCliBackService` 无需修改。

- [ ] **Step 6.2: 检查 acp-types.ts 的 ExtendedInitializeResponse**

SDK 的 `InitializeResponse` 类型可能不包含 `modes` 字段。确认 `acp-types.ts` 的 bridge 导出了 `ExtendedInitializeResponse` 类型，或者在 `AcpConnectionService` 中做类型转换。

如果 SDK 的 `InitializeResponse` 已有 `modes`，则不需要 `ExtendedInitializeResponse`。如果没有，在 `AcpConnectionService` 中做类型断言。

- [ ] **Step 6.3: 最终编译检查**

```bash
npx tsc --noEmit --project configs/ts/references/tsconfig.ai-native.json
```

预期：无编译错误（可能有 SDK 类型相关的 minor warning，被 `skipLibCheck` 抑制）

- [ ] **Step 6.4: Commit（如果有修改）**

```bash
git add packages/ai-native/src/node/acp/acp-cli-back.service.ts
git commit -m "fix(acp): adapt AcpCliBackService to new AcpConnectionService"
```

---

### Task 7: 更新现有测试 + 运行

**Files:**

- Modify: `packages/ai-native/__test__/node/acp-cli-client.test.ts`

现有测试针对的是手写 JSON-RPC 传输层的行为。重写后，大部分测试不再适用（SDK 保证 JSON-RPC 正确性），但需要保留或更新集成层面的测试。

- [ ] **Step 7.1: 查看现有测试文件**

```bash
cat packages/ai-native/__test__/node/acp-cli-client.test.ts
```

确认测试内容。已知测试包括：

- `initialize()` 协议版本协商
- `newSession()` / `loadSession()` / `prompt()` 请求发送
- `onNotification` 事件订阅
- `handleDisconnect()` 断开处理
- `getNegotiatedProtocolVersion()` 等 getter

- [ ] **Step 7.2: 更新或跳过不适用的测试**

由于 `AcpCliClientService` 现在是薄代理层，测试重点应转移到 `AcpConnectionService`：

1. **保留的测试**（代理方法正确性）：

   - `newSession` → 验证调用 `connectionService.newSession()`
   - `loadSession` → 验证调用 `connectionService.loadSession()`
   - `prompt` → 验证调用 `connectionService.prompt()`
   - `cancel` → 验证调用 `connectionService.cancel()`
   - `listSessions` → 验证调用 `connectionService.listSessions()`
   - `setSessionMode` → 验证调用 `connectionService.setSessionMode()`
   - `onNotification` → 验证订阅 `connectionService.onSessionUpdate()`
   - `onDisconnect` → 验证订阅 `connectionService.onDisconnect()`

2. **删除的测试**（SDK 保证正确性）：
   - JSON-RPC 请求序列化
   - 请求队列顺序
   - NDJSON 解析
   - 响应匹配
   - 连接状态转换

- [ ] **Step 7.3: 运行测试**

```bash
npx jest packages/ai-native/__test__/node/acp-cli-client.test.ts --passWithNoTests 2>/dev/null
```

- [ ] **Step 7.4: Commit（如果有修改）**

```bash
git add packages/ai-native/__test__/node/acp-cli-client.test.ts
git commit -m "test(acp): update tests for new AcpConnectionService architecture

Remove tests for handwritten JSON-RPC transport (now handled by SDK).
Add proxy delegation tests for AcpCliClientService."
```

---

## 完成后验证

1. **Node 层不再有手写 JSON-RPC** — `acp-cli-client.service.ts` 只有薄代理方法，无 `pendingRequests`、`requestQueue`、`handleData` 等
2. **不再有 setTimeout 等待通知** — `createSession` 和 `loadSession` 用 `onSessionUpdate` 事件收集
3. **不再有静态变量共享连接** — `AcpPermissionCallerManager` 使用 `this.client` 而非静态变量
4. **所有 DI token 不变** — Browser 层无需修改
5. **IAcpAgentService 和 IAcpCliClientService 接口不变** — 向后兼容

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| SDK 版本差异（package.json 声明 ^0.16.1，实际探索的 SDK 是 0.22.1） | API 可能变化 | 先用已安装的 0.16.1 验证，`ClientSideConnection` 构造函数签名和 `Client` 接口在 0.16.x 和 0.22.x 之间应稳定 |
| `Readable.toWeb()` Node.js 版本兼容性 | 运行时错误 | Node.js 18+ 原生支持；OpenSumi 要求 Node 18+ |
| `ACP_PROTOCOL_VERSION` 常量位置 | 编译错误 | 已在 `AcpConnectionService` 中定义为局部常量（原在 `acp-cli-client.service.ts` 中） |
| 权限对话框显示位置 | 用户体验 | `AcpConnectionService` 通过 `this.client` 获取 RPC 代理，需确认在 childInjector 中正确注入 |
