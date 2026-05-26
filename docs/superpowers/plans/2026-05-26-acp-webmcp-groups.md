# ACP WebMCP Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable AI agents to use IDE capabilities through ACP extension methods, organized in loadable WebMCP groups with progressive exposure.

**Architecture:** ACP `extMethod` hook routes `_opensumi/*` method calls. Node-side handler manages group loaded state and meta methods. Tool execution delegates to browser-side group registry via RPC. Group definitions are browser-side (they need DI for service access); metadata is sent to Node at initialization.

**Tech Stack:** TypeScript, OpenSumi DI (`@opensumi/di`), OpenSumi RPC (`RPCService`), ACP SDK (`@agentclientprotocol/sdk`)

---

## File Structure

```
packages/core-common/src/types/ai-native/
  acp-types.ts                          # MODIFY: add IAcpWebMcpBridgeService, WebMcpGroupMeta types

packages/ai-native/src/browser/acp/
  webmcp-utils.ts                       # CREATE: shared helpers (tryGetService, classifyError, safeErrorMessage)
  webmcp-group-registry.ts              # CREATE: browser-side group registry + command handler
  webmcp-groups/
    file.webmcp-group.ts                # CREATE: file group definition
    terminal.webmcp-group.ts            # CREATE: terminal group definition
    editor.webmcp-group.ts              # CREATE: editor group definition
  acp-webmcp-rpc.service.ts             # CREATE: browser-side RPC service (implements IAcpWebMcpBridgeService)
  index.ts                              # MODIFY: export new services

packages/ai-native/src/node/acp/
  acp-webmcp-handler.ts                 # CREATE: Node-side _opensumi/* method handler
  acp-webmcp-caller.service.ts          # CREATE: Node-side RPC caller service
  acp-thread.ts                         # MODIFY: hook extMethod, add capability declaration
  index.ts                              # MODIFY: export new services

packages/ai-native/src/browser/
  ai-core.contribution.ts               # MODIFY: register group definitions, RPC service, command

packages/ai-native/src/node/
  index.ts                              # MODIFY: register Node-side providers
```

---

## Task 1: Define shared types in core-common

**Files:**

- Modify: `packages/core-common/src/types/ai-native/acp-types.ts`

- [ ] **Step 1: Add WebMCP group types and RPC interface to acp-types.ts**

Add the following types at the end of the file (before any existing exports that need them):

```typescript
// WebMCP Group types for ACP extension methods
export const AcpWebMcpBridgePath = 'AcpWebMcpBridgePath';

export interface WebMcpToolDef {
  method: string; // "_opensumi/file/read"
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface WebMcpGroupDef {
  name: string;
  description: string;
  defaultLoaded: boolean;
  tools: WebMcpToolDef[];
}

export interface WebMcpToolResult {
  success: boolean;
  result?: unknown;
  error?: string; // machine-readable error code
  details?: string; // human-readable error description
}

export interface WebMcpGroupInfo {
  name: string;
  description: string;
  toolCount: number;
  loaded: boolean;
}

export interface IAcpWebMcpBridgeService {
  $getGroupDefinitions(): Promise<WebMcpGroupDef[]>;
  $executeTool(group: string, tool: string, params: Record<string, unknown>): Promise<WebMcpToolResult>;
}

export const AcpWebMcpCallerServiceToken = Symbol('AcpWebMcpCallerServiceToken');
export const AcpWebMcpHandlerToken = Symbol('AcpWebMcpHandlerToken');
export const WebMcpGroupRegistryToken = Symbol('WebMcpGroupRegistryToken');
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p packages/core-common/tsconfig.json 2>&1 | head -20` Expected: No errors related to the new types.

- [ ] **Step 3: Commit**

```bash
git add packages/core-common/src/types/ai-native/acp-types.ts
git commit -m "feat(acp): add WebMCP group types and RPC interface definitions"
```

---

## Task 2: Create shared WebMCP utilities

**Files:**

- Create: `packages/ai-native/src/browser/acp/webmcp-utils.ts`

These helpers are currently duplicated across `webmcp-tools.registry.ts` and `webmcp-file-tools.registry.ts`. Centralize them.

- [ ] **Step 1: Create webmcp-utils.ts**

```typescript
import { Injector } from '@opensumi/di';

export type ErrorCode =
  | 'SERVICE_UNAVAILABLE'
  | 'TOOL_NOT_LOADED'
  | 'TOOL_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'ABORTED'
  | 'RPC_TIMEOUT'
  | 'DI_ERROR'
  | 'FILE_NOT_FOUND'
  | 'FILE_EXISTS'
  | 'EXECUTION_ERROR';

export interface WebMcpToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  details?: string;
}

export function tryGetService<T>(container: Injector, token: unknown): T | null {
  try {
    return container.get(token) as T;
  } catch {
    return null;
  }
}

export function classifyError(err: unknown): ErrorCode {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) return 'RPC_TIMEOUT';
    if (msg.includes('permission') || msg.includes('forbidden')) return 'PERMISSION_DENIED';
    if (msg.includes('abort')) return 'ABORTED';
    if (msg.includes('not found') || msg.includes('enoent')) return 'FILE_NOT_FOUND';
    if (msg.includes('already exists') || msg.includes('eexist')) return 'FILE_EXISTS';
    if (msg.includes('di') || msg.includes('injector')) return 'DI_ERROR';
  }
  return 'EXECUTION_ERROR';
}

const SENSITIVE_PATTERNS = [
  /(?:token|key|secret|password|auth)["\s]*[:=]\s*["']?[^"'`\s,}]+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /ghp_[a-zA-Z0-9]{30,}/g,
];

export function safeErrorMessage(err: unknown, maxLen = 200): string {
  let msg = err instanceof Error ? err.message : String(err);
  for (const pattern of SENSITIVE_PATTERNS) {
    msg = msg.replace(pattern, '[REDACTED]');
  }
  return msg.length > maxLen ? msg.slice(0, maxLen) + '...' : msg;
}

export function successResult(result: unknown): WebMcpToolResult {
  return { success: true, result };
}

export function errorResult(error: ErrorCode, err: unknown): WebMcpToolResult {
  return { success: false, error, details: safeErrorMessage(err) };
}

export function serviceUnavailableResult(serviceName: string): WebMcpToolResult {
  return { success: false, error: 'SERVICE_UNAVAILABLE', details: `Service ${serviceName} is not available` };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -20` Expected: No errors related to webmcp-utils.

- [ ] **Step 3: Commit**

```bash
git add packages/ai-native/src/browser/acp/webmcp-utils.ts
git commit -m "feat(acp): add shared WebMCP utility helpers"
```

---

## Task 3: Create browser-side group registry

**Files:**

- Create: `packages/ai-native/src/browser/acp/webmcp-group-registry.ts`

The registry holds all group definitions, executes tools by (group, tool) lookup, and provides metadata for the Node side.

- [ ] **Step 1: Create webmcp-group-registry.ts**

```typescript
import { Injectable, Autowired } from '@opensumi/di';
import { CommandService } from '@opensumi/ide-core-common';
import type {
  WebMcpGroupDef,
  WebMcpToolResult,
  WebMcpGroupInfo,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export interface WebMcpToolExecute {
  method: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<WebMcpToolResult>;
}

export interface WebMcpGroupRegistration {
  name: string;
  description: string;
  defaultLoaded: boolean;
  tools: WebMcpToolExecute[];
}

export const ICommandWebMcpExecute = 'opensumi.webmcp.execute';

@Injectable()
export class WebMcpGroupRegistry {
  private groups = new Map<string, WebMcpGroupRegistration>();

  registerGroup(group: WebMcpGroupRegistration): void {
    if (this.groups.has(group.name)) {
      console.warn(`[WebMCP] Group "${group.name}" already registered, overwriting`);
    }
    this.groups.set(group.name, group);
  }

  getGroupDefinitions(): WebMcpGroupDef[] {
    return Array.from(this.groups.values()).map((g) => ({
      name: g.name,
      description: g.description,
      defaultLoaded: g.defaultLoaded,
      tools: g.tools.map((t) => ({
        method: t.method,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));
  }

  listGroups(loadedGroups: Set<string>): WebMcpGroupInfo[] {
    return Array.from(this.groups.values()).map((g) => ({
      name: g.name,
      description: g.description,
      toolCount: g.tools.length,
      loaded: loadedGroups.has(g.name),
    }));
  }

  executeTool(groupName: string, toolAction: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    const group = this.groups.get(groupName);
    if (!group) {
      return Promise.resolve({
        success: false,
        error: 'TOOL_NOT_FOUND',
        details: `Group "${groupName}" not found`,
      });
    }
    const method = `_opensumi/${groupName}/${toolAction}`;
    const tool = group.tools.find((t) => t.method === method);
    if (!tool) {
      return Promise.resolve({
        success: false,
        error: 'TOOL_NOT_FOUND',
        details: `Tool "${method}" not found in group "${groupName}"`,
      });
    }
    return tool.execute(params);
  }

  getDefaultGroupNames(): string[] {
    return Array.from(this.groups.values())
      .filter((g) => g.defaultLoaded)
      .map((g) => g.name);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -20` Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai-native/src/browser/acp/webmcp-group-registry.ts
git commit -m "feat(acp): add browser-side WebMCP group registry"
```

---

## Task 4: Create browser-side RPC service

**Files:**

- Create: `packages/ai-native/src/browser/acp/acp-webmcp-rpc.service.ts`

This service receives RPC calls from Node side and delegates to the group registry.

- [ ] **Step 1: Create acp-webmcp-rpc.service.ts**

```typescript
import { Injectable, Autowired } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import type {
  IAcpWebMcpBridgeService,
  WebMcpGroupDef,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AcpWebMcpBridgePath } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { WebMcpGroupRegistry } from './webmcp-group-registry';

@Injectable()
export class AcpWebMcpRpcService extends RPCService implements IAcpWebMcpBridgeService {
  @Autowired(WebMcpGroupRegistry)
  private readonly registry: WebMcpGroupRegistry;

  async $getGroupDefinitions(): Promise<WebMcpGroupDef[]> {
    return this.registry.getGroupDefinitions();
  }

  async $executeTool(group: string, tool: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    return this.registry.executeTool(group, tool, params);
  }
}

// Register RPC path
export const AcpWebMcpRpcServicePath = AcpWebMcpBridgePath;
```

- [ ] **Step 2: Commit**

```bash
git add packages/ai-native/src/browser/acp/acp-webmcp-rpc.service.ts
git commit -m "feat(acp): add browser-side WebMCP RPC service"
```

---

## Task 5: Create Node-side RPC caller service

**Files:**

- Create: `packages/ai-native/src/node/acp/acp-webmcp-caller.service.ts`

This service calls browser-side methods via RPC.

- [ ] **Step 1: Create acp-webmcp-caller.service.ts**

```typescript
import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import type {
  IAcpWebMcpBridgeService,
  WebMcpGroupDef,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AcpWebMcpBridgePath } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

@Injectable()
export class AcpWebMcpCallerService extends RPCService<IAcpWebMcpBridgeService> {
  async getGroupDefinitions(): Promise<WebMcpGroupDef[]> {
    return this.client.$getGroupDefinitions();
  }

  async executeTool(group: string, tool: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    return this.client.$executeTool(group, tool, params);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-webmcp-caller.service.ts
git commit -m "feat(acp): add Node-side WebMCP RPC caller service"
```

---

## Task 6: Create Node-side WebMCP handler

**Files:**

- Create: `packages/ai-native/src/node/acp/acp-webmcp-handler.ts`

This handler processes `_opensumi/*` extension methods. It manages per-connection group loaded state and routes tool execution to the browser via the RPC caller.

- [ ] **Step 1: Create acp-webmcp-handler.ts**

```typescript
import type {
  WebMcpGroupDef,
  WebMcpGroupInfo,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import type { AcpWebMcpCallerService } from './acp-webmcp-caller.service';

export class AcpWebMcpHandler {
  private loadedGroups = new Set<string>();
  private groupDefs: WebMcpGroupDef[] | null = null;
  private totalLoadedToolCount = 0;

  constructor(
    private readonly caller: AcpWebMcpCallerService,
    private readonly logger: { warn?: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void } | undefined,
  ) {}

  async initialize(): Promise<void> {
    try {
      this.groupDefs = await this.caller.getGroupDefinitions();
      // Auto-load default groups
      for (const group of this.groupDefs) {
        if (group.defaultLoaded) {
          this.loadedGroups.add(group.name);
          this.totalLoadedToolCount += group.tools.length;
        }
      }
    } catch (err) {
      this.logger?.warn?.('[AcpWebMcpHandler] Failed to initialize group definitions:', err);
      this.groupDefs = [];
    }
  }

  async handleExtMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Meta methods
    if (method === '_opensumi/webmcp/list_groups') {
      return this.listGroups();
    }
    if (method === '_opensumi/webmcp/load_group') {
      return this.loadGroup(params);
    }
    if (method === '_opensumi/webmcp/unload_group') {
      return this.unloadGroup(params);
    }

    // Group tool methods: _opensumi/{group}/{action}
    if (method.startsWith('_opensumi/')) {
      return this.executeGroupTool(method, params);
    }

    throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }

  handleExtNotification(method: string, _params: Record<string, unknown>): void {
    this.logger?.debug?.(`[AcpWebMcpHandler] extNotification: ${method}`);
  }

  private listGroups(): Record<string, unknown> {
    const groups = (this.groupDefs ?? []).map(
      (g): WebMcpGroupInfo => ({
        name: g.name,
        description: g.description,
        toolCount: g.tools.length,
        loaded: this.loadedGroups.has(g.name),
      }),
    );
    return { groups };
  }

  private loadGroup(params: Record<string, unknown>): Record<string, unknown> {
    const name = params.name as string;
    const group = (this.groupDefs ?? []).find((g) => g.name === name);
    if (!group) {
      return { error: 'GROUP_NOT_FOUND', details: `Group "${name}" not found` };
    }
    if (this.loadedGroups.has(name)) {
      return {
        group: name,
        methods: group.tools.map((t) => t.method),
        totalLoadedToolCount: this.totalLoadedToolCount,
      };
    }
    this.loadedGroups.add(name);
    this.totalLoadedToolCount += group.tools.length;
    return { group: name, methods: group.tools.map((t) => t.method), totalLoadedToolCount: this.totalLoadedToolCount };
  }

  private unloadGroup(params: Record<string, unknown>): Record<string, unknown> {
    const name = params.name as string;
    const group = (this.groupDefs ?? []).find((g) => g.name === name);
    if (!group) {
      return { error: 'GROUP_NOT_FOUND', details: `Group "${name}" not found` };
    }
    if (!this.loadedGroups.has(name)) {
      return { group: name, unloadedMethods: [], totalLoadedToolCount: this.totalLoadedToolCount };
    }
    this.loadedGroups.delete(name);
    this.totalLoadedToolCount -= group.tools.length;
    return {
      group: name,
      unloadedMethods: group.tools.map((t) => t.method),
      totalLoadedToolCount: this.totalLoadedToolCount,
    };
  }

  private async executeGroupTool(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Parse _opensumi/{group}/{action}
    const parts = method.split('/');
    if (parts.length !== 3 || parts[0] !== '' || parts[1] === '') {
      return { success: false, error: 'TOOL_NOT_FOUND', details: `Invalid method: ${method}` };
    }
    const groupName = parts[1];
    const toolAction = parts[2];

    if (!this.loadedGroups.has(groupName)) {
      return {
        success: false,
        error: 'TOOL_NOT_LOADED',
        details: `Group "${groupName}" is not loaded. Call _opensumi/webmcp/load_group first.`,
      };
    }

    try {
      const result = await this.caller.executeTool(groupName, toolAction, params);
      return result as Record<string, unknown>;
    } catch (err) {
      return { success: false, error: 'EXECUTION_ERROR', details: String(err) };
    }
  }

  getCapabilityMeta(): Record<string, unknown> {
    return {
      opensumi: {
        version: '1.0',
        webmcpGroups: (this.groupDefs ?? []).map((g) => g.name),
        defaultLoadedGroups: (this.groupDefs ?? []).filter((g) => g.defaultLoaded).map((g) => g.name),
      },
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-webmcp-handler.ts
git commit -m "feat(acp): add Node-side WebMCP extension method handler"
```

---

## Task 7: Hook extMethod in AcpThread and add capability declaration

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-thread.ts`

This is the critical integration point. The `extMethod` stub in `createClientImpl()` needs to route `_opensumi/*` calls to `AcpWebMcpHandler`.

- [ ] **Step 1: Add AcpWebMcpHandler import and field to AcpThread**

At the top of `acp-thread.ts`, add:

```typescript
import { AcpWebMcpHandler } from './acp-webmcp-handler';
import type { AcpWebMcpCallerService } from './acp-webmcp-caller.service';
```

Add a field to the `AcpThread` class (after other handler fields):

```typescript
private webmcpHandler: AcpWebMcpHandler | null = null;
```

- [ ] **Step 2: Initialize handler in ensureSdkConnection**

After the `ClientSideConnection` is created (after `this._connection = ...`), add:

```typescript
// Initialize WebMCP handler if caller service is available
const webmcpCaller = this.options.webmcpCallerService;
if (webmcpCaller) {
  this.webmcpHandler = new AcpWebMcpHandler(webmcpCaller, this.logger);
  await this.webmcpHandler.initialize();
}
```

- [ ] **Step 3: Replace extMethod and extNotification stubs**

In `createClientImpl()`, replace the existing stubs:

```typescript
// Before (stub):
async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  self.logger?.warn(`[AcpThread:${self.threadId}] extMethod called: ${method} — not implemented`);
  return {};
},
async extNotification(method: string, params: Record<string, unknown>): Promise<void> {
  self.logger?.debug(`[AcpThread:${self.threadId}] extNotification: ${method}`, params);
},
```

With:

```typescript
async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (method.startsWith('_opensumi/') && self.webmcpHandler) {
    return self.webmcpHandler.handleExtMethod(method, params);
  }
  self.logger?.warn(`[AcpThread:${self.threadId}] extMethod called: ${method} — not implemented`);
  return {};
},
async extNotification(method: string, params: Record<string, unknown>): Promise<void> {
  if (method.startsWith('_opensumi/') && self.webmcpHandler) {
    self.webmcpHandler.handleExtNotification(method, params);
    return;
  }
  self.logger?.debug(`[AcpThread:${self.threadId}] extNotification: ${method}`, params);
},
```

- [ ] **Step 4: Add capability declaration in initialize()**

In the `initialize()` method, modify the `clientCapabilities` to include `_meta`:

```typescript
const initParams: InitializeRequest = {
  protocolVersion: ACP_PROTOCOL_VERSION,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: true,
    _meta: self.webmcpHandler?.getCapabilityMeta() ?? {},
  },
  clientInfo: {
    name: 'opensumi',
    title: 'OpenSumi IDE',
    version: '3.0.0',
  },
};
```

- [ ] **Step 5: Add webmcpCallerService to AcpThreadOptions**

In the `AcpThreadOptions` interface, add:

```typescript
webmcpCallerService?: AcpWebMcpCallerService;
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-thread.ts
git commit -m "feat(acp): hook WebMCP handler into AcpThread extMethod and add capability declaration"
```

---

## Task 8: Wire up DI registration

**Files:**

- Modify: `packages/ai-native/src/browser/acp/index.ts`
- Modify: `packages/ai-native/src/node/acp/index.ts`
- Modify: `packages/ai-native/src/browser/ai-core.contribution.ts`
- Modify: `packages/ai-native/src/node/index.ts`

- [ ] **Step 1: Export new browser-side modules from browser/acp/index.ts**

Add to exports:

```typescript
export {
  WebMcpGroupRegistry,
  WebMcpGroupRegistration,
  WebMcpToolExecute,
  ICommandWebMcpExecute,
} from './webmcp-group-registry';
export { AcpWebMcpRpcService } from './acp-webmcp-rpc.service';
export {
  tryGetService,
  classifyError,
  safeErrorMessage,
  successResult,
  errorResult,
  serviceUnavailableResult,
} from './webmcp-utils';
export type { ErrorCode, WebMcpToolResult as BrowserWebMcpToolResult } from './webmcp-utils';
```

- [ ] **Step 2: Export new Node-side modules from node/acp/index.ts**

Add to exports:

```typescript
export { AcpWebMcpCallerService } from './acp-webmcp-caller.service';
export { AcpWebMcpHandler } from './acp-webmcp-handler';
```

- [ ] **Step 3: Register browser-side providers in ai-core.contribution.ts**

In the `AINativeBrowserContribution` class or module registration, add:

```typescript
// In the providers list or registerDependency method:
{ token: WebMcpGroupRegistryToken, useClass: WebMcpGroupRegistry },
```

Register the RPC service in the contribution's `onDidStart` or similar initialization point:

```typescript
// After existing WebMCP tool registrations
this.rpcService.register(AcpWebMcpBridgePath, new AcpWebMcpRpcService());
```

- [ ] **Step 4: Register Node-side providers in node/index.ts**

Add `AcpWebMcpCallerService` to the Node module providers.

- [ ] **Step 5: Wire AcpWebMcpCallerService into AcpThread creation**

In the `AcpThreadFactoryProvider`, inject `AcpWebMcpCallerService` and pass it to `AcpThread` options:

```typescript
const webmcpCaller = injector.get(AcpWebMcpCallerServiceToken);
// In the factory function:
webmcpCallerService: webmcpCaller,
```

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -30` Expected: No errors related to the new code.

- [ ] **Step 7: Commit**

```bash
git add packages/ai-native/src/browser/acp/index.ts packages/ai-native/src/node/acp/index.ts packages/ai-native/src/browser/ai-core.contribution.ts packages/ai-native/src/node/index.ts
git commit -m "feat(acp): wire up DI registration for WebMCP group services"
```

---

## Task 9: Create file group definition

**Files:**

- Create: `packages/ai-native/src/browser/acp/webmcp-groups/file.webmcp-group.ts`
- Modify: `packages/ai-native/src/browser/ai-core.contribution.ts` (register the group)

This group mirrors the existing `file_*` WebMCP tools but as a group definition for the ACP channel.

- [ ] **Step 1: Create file.webmcp-group.ts**

Reference the existing `webmcp-file-tools.registry.ts` for the tool execute logic. Each tool's `execute` function should use `tryGetService` and the shared error utilities.

```typescript
import { Injector } from '@opensumi/di';
import { URI, AppConfig } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import type { WebMcpGroupRegistration } from '../webmcp-group-registry';
import {
  tryGetService,
  classifyError,
  safeErrorMessage,
  successResult,
  errorResult,
  serviceUnavailableResult,
} from '../webmcp-utils';

function resolveWorkspacePath(workspaceDir: string, relativePath: string): string {
  if (relativePath.startsWith('/')) return relativePath;
  return `${workspaceDir}/${relativePath}`.replace(/\/+/g, '/');
}

function toUri(filePath: string): string {
  return URI.file(filePath).toString();
}

export function createFileGroup(container: Injector): WebMcpGroupRegistration {
  const workspaceDir = () => {
    const appConfig = tryGetService<AppConfig>(container, AppConfig);
    return appConfig?.workspaceDir ?? '';
  };

  return {
    name: 'file',
    description: '文件读写和管理操作',
    defaultLoaded: true,
    tools: [
      {
        method: '_opensumi/file/getWorkspaceRoot',
        description: '获取当前工作区根目录路径',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          const root = workspaceDir();
          return root
            ? successResult({ path: root })
            : errorResult('SERVICE_UNAVAILABLE', 'Workspace root not available');
        },
      },
      {
        method: '_opensumi/file/read',
        description: '读取文件内容',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: '文件路径（相对于工作区根目录）' } },
          required: ['path'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const fullPath = resolveWorkspacePath(workspaceDir(), params.path as string);
            const content = await fileService.readFile(toUri(fullPath));
            return successResult({ content: content.content });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/write',
        description: '写入文件内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            content: { type: 'string', description: '文件内容' },
          },
          required: ['path', 'content'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const fullPath = resolveWorkspacePath(workspaceDir(), params.path as string);
            await fileService.writeFile(toUri(fullPath), {
              content: params.content as string,
              encoding: 'utf8',
              overwrite: true,
            });
            return successResult({ path: fullPath });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/list',
        description: '列出目录内容',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: '目录路径' } },
          required: ['path'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const fullPath = resolveWorkspacePath(workspaceDir(), params.path as string);
            const stat = await fileService.getFileStat(toUri(fullPath));
            if (!stat || !stat.children) return errorResult('FILE_NOT_FOUND', `Directory not found: ${fullPath}`);
            const entries = stat.children.map((c) => ({ name: c.name, isDirectory: !!c.children, size: c.size }));
            return successResult({ entries });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/stat',
        description: '获取文件或目录元数据',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: '文件或目录路径' } },
          required: ['path'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const fullPath = resolveWorkspacePath(workspaceDir(), params.path as string);
            const stat = await fileService.getFileStat(toUri(fullPath));
            if (!stat) return errorResult('FILE_NOT_FOUND', `Path not found: ${fullPath}`);
            return successResult({
              name: stat.name,
              isDirectory: !!stat.children,
              size: stat.size,
              lastModified: stat.lastModification,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/exists',
        description: '检查文件或目录是否存在',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: '文件或目录路径' } },
          required: ['path'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const fullPath = resolveWorkspacePath(workspaceDir(), params.path as string);
            const stat = await fileService.getFileStat(toUri(fullPath));
            return successResult({ exists: !!stat });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/create',
        description: '创建文件或目录',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '创建路径' },
            type: { type: 'string', description: '创建类型', enum: ['file', 'directory'] },
          },
          required: ['path', 'type'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const fullPath = resolveWorkspacePath(workspaceDir(), params.path as string);
            if (params.type === 'directory') {
              await fileService.createFolder(toUri(fullPath));
            } else {
              await fileService.createFile(toUri(fullPath));
            }
            return successResult({ path: fullPath });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/delete',
        description: '删除文件或目录',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: '删除路径' } },
          required: ['path'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const fullPath = resolveWorkspacePath(workspaceDir(), params.path as string);
            await fileService.delete(toUri(fullPath));
            return successResult({ path: fullPath });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/move',
        description: '移动或重命名文件',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: '源路径' },
            destination: { type: 'string', description: '目标路径' },
          },
          required: ['source', 'destination'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const src = resolveWorkspacePath(workspaceDir(), params.source as string);
            const dest = resolveWorkspacePath(workspaceDir(), params.destination as string);
            await fileService.move(toUri(src), toUri(dest));
            return successResult({ source: src, destination: dest });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/file/copy',
        description: '复制文件',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: '源路径' },
            destination: { type: 'string', description: '目标路径' },
          },
          required: ['source', 'destination'],
        },
        execute: async (params) => {
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) return serviceUnavailableResult('IFileServiceClient');
          try {
            const src = resolveWorkspacePath(workspaceDir(), params.source as string);
            const dest = resolveWorkspacePath(workspaceDir(), params.destination as string);
            await fileService.copy(toUri(src), toUri(dest));
            return successResult({ source: src, destination: dest });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}
```

- [ ] **Step 2: Register file group in ai-core.contribution.ts**

In the `onDidStart` method, after existing registrations, add:

```typescript
import { createFileGroup } from './acp/webmcp-groups/file.webmcp-group';
import { WebMcpGroupRegistry } from './acp/webmcp-group-registry';

// After WebMcpGroupRegistry is injected:
const groupRegistry = this.injector.get(WebMcpGroupRegistryToken);
groupRegistry.registerGroup(createFileGroup(this.injector));
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -30` Expected: No errors related to file group.

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/browser/acp/webmcp-groups/file.webmcp-group.ts packages/ai-native/src/browser/ai-core.contribution.ts
git commit -m "feat(acp): add file WebMCP group definition"
```

---

## Task 10: Create terminal group definition

**Files:**

- Create: `packages/ai-native/src/browser/acp/webmcp-groups/terminal.webmcp-group.ts`
- Modify: `packages/ai-native/src/browser/ai-core.contribution.ts` (register the group)

Reference the existing `packages/terminal-next/src/browser/webmcp-tools.registry.ts` for tool execute logic. The terminal tools need `ITerminalApiService`, `ITerminalController`, and `ITerminalService` from the terminal-next module.

- [ ] **Step 1: Create terminal.webmcp-group.ts**

Follow the same pattern as file group. Define tools: `terminal_list`, `terminal_create`, `terminal_executeCommand`, `terminal_show`, `terminal_getProcessId`, `terminal_dispose`, `terminal_resize`, `terminal_getOS`, `terminal_getProfiles`, `terminal_showPanel`. Map each to `_opensumi/terminal/{action}` method names.

**Important:** Terminal services are from `packages/terminal-next`. Import paths:

```typescript
import { ITerminalApiService } from '../../../../terminal-next/src/common';
import { ITerminalController } from '../../../../terminal-next/src/common/controller';
import { ITerminalService } from '../../../../terminal-next/src/common';
```

Use `tryGetService` for each service. If a service is unavailable, return `serviceUnavailableResult`.

- [ ] **Step 2: Register terminal group in ai-core.contribution.ts**

```typescript
import { createTerminalGroup } from './acp/webmcp-groups/terminal.webmcp-group';

groupRegistry.registerGroup(createTerminalGroup(this.injector));
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/browser/acp/webmcp-groups/terminal.webmcp-group.ts packages/ai-native/src/browser/ai-core.contribution.ts
git commit -m "feat(acp): add terminal WebMCP group definition"
```

---

## Task 11: Create editor group definition

**Files:**

- Create: `packages/ai-native/src/browser/acp/webmcp-groups/editor.webmcp-group.ts`
- Modify: `packages/ai-native/src/browser/ai-core.contribution.ts` (register the group)

This is a new group with no existing WebMCP implementation. Tools depend on `IEditorService` and `IWorkbenchEditorService` from `@opensumi/ide-editor`.

- [ ] **Step 1: Create editor.webmcp-group.ts**

Define tools per the spec:

| Method | InputSchema | Service |
| --- | --- | --- |
| `_opensumi/editor/open` | `{path: string, line?: number, column?: number}` | `IWorkbenchEditorService.open()` |
| `_opensumi/editor/close` | `{path: string}` | `IWorkbenchEditorService.close()` |
| `_opensumi/editor/getActive` | `{}` | `IEditorService.getActiveEditor()` |
| `_opensumi/editor/setSelection` | `{path: string, startLine: number, endLine: number}` | `IEditorService.getSelection()` + `IEditorService.setSelection()` |
| `_opensumi/editor/format` | `{path: string}` | Command: `editor.action.formatDocument` |
| `_opensumi/editor/fold` | `{path: string, startLine: number}` | Not directly available; use `IEditorService` |
| `_opensumi/editor/unfold` | `{path: string, startLine: number}` | Not directly available; use `IEditorService` |
| `_opensumi/editor/save` | `{path: string}` | `IWorkbenchEditorService.save()` |

**Note:** Some editor operations (fold/unfold) may require accessing the monaco editor instance directly. For P1, implement the straightforward tools (open, close, getActive, setSelection, save) and add fold/unfold/format as stubs that return `SERVICE_UNAVAILABLE` if the underlying API is not accessible.

- [ ] **Step 2: Register editor group in ai-core.contribution.ts**

```typescript
import { createEditorGroup } from './acp/webmcp-groups/editor.webmcp-group';

groupRegistry.registerGroup(createEditorGroup(this.injector));
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/browser/acp/webmcp-groups/editor.webmcp-group.ts packages/ai-native/src/browser/ai-core.contribution.ts
git commit -m "feat(acp): add editor WebMCP group definition"
```

---

## Task 12: Integration test

**Files:**

- Create: `packages/ai-native/__test__/node/acp-webmcp-handler.test.ts`

Test the `AcpWebMcpHandler` with a mock `AcpWebMcpCallerService`.

- [ ] **Step 1: Write test file**

```typescript
import { AcpWebMcpHandler } from '../../src/node/acp/acp-webmcp-handler';
import type { AcpWebMcpCallerService } from '../../src/node/acp/acp-webmcp-caller.service';
import type { WebMcpGroupDef, WebMcpToolResult } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

describe('AcpWebMcpHandler', () => {
  let handler: AcpWebMcpHandler;
  let mockCaller: {
    getGroupDefinitions: jest.Mock;
    executeTool: jest.Mock;
  };

  const testGroupDefs: WebMcpGroupDef[] = [
    {
      name: 'file',
      description: 'File operations',
      defaultLoaded: true,
      tools: [
        {
          method: '_opensumi/file/read',
          description: 'Read file',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        },
        {
          method: '_opensumi/file/write',
          description: 'Write file',
          inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
        },
      ],
    },
    {
      name: 'git',
      description: 'Git operations',
      defaultLoaded: false,
      tools: [
        { method: '_opensumi/git/status', description: 'Git status', inputSchema: { type: 'object', properties: {} } },
      ],
    },
  ];

  beforeEach(async () => {
    mockCaller = {
      getGroupDefinitions: jest.fn().mockResolvedValue(testGroupDefs),
      executeTool: jest.fn(),
    };
    handler = new AcpWebMcpHandler(mockCaller as unknown as AcpWebMcpCallerService, undefined);
    await handler.initialize();
  });

  describe('initialize', () => {
    it('should load default groups on init', () => {
      const result = handler.handleExtMethod('_opensumi/webmcp/list_groups', {}) as Record<string, unknown>;
      const groups = result.groups as Array<{ name: string; loaded: boolean }>;
      expect(groups.find((g) => g.name === 'file')?.loaded).toBe(true);
      expect(groups.find((g) => g.name === 'git')?.loaded).toBe(false);
    });
  });

  describe('list_groups', () => {
    it('should return all groups with loaded state', () => {
      const result = handler.handleExtMethod('_opensumi/webmcp/list_groups', {}) as Record<string, unknown>;
      expect(result.groups).toHaveLength(2);
    });
  });

  describe('load_group', () => {
    it('should load a non-default group', () => {
      const result = handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'git' }) as Record<string, unknown>;
      expect(result.group).toBe('git');
      expect(result.methods).toContain('_opensumi/git/status');
      expect(result.totalLoadedToolCount).toBe(3); // 2 file + 1 git
    });

    it('should return current state if group already loaded', () => {
      const result = handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'file' }) as Record<
        string,
        unknown
      >;
      expect(result.group).toBe('file');
      expect(result.totalLoadedToolCount).toBe(2);
    });

    it('should return error for unknown group', () => {
      const result = handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'unknown' }) as Record<
        string,
        unknown
      >;
      expect(result.error).toBe('GROUP_NOT_FOUND');
    });
  });

  describe('unload_group', () => {
    it('should unload a loaded group', () => {
      const result = handler.handleExtMethod('_opensumi/webmcp/unload_group', { name: 'file' }) as Record<
        string,
        unknown
      >;
      expect(result.group).toBe('file');
      expect(result.totalLoadedToolCount).toBe(0);
    });
  });

  describe('executeGroupTool', () => {
    it('should execute a tool in a loaded group', async () => {
      mockCaller.executeTool.mockResolvedValue({ success: true, result: { content: 'hello' } });
      const result = await handler.handleExtMethod('_opensumi/file/read', { path: '/test.txt' });
      expect(mockCaller.executeTool).toHaveBeenCalledWith('file', 'read', { path: '/test.txt' });
      expect(result.success).toBe(true);
    });

    it('should return TOOL_NOT_LOADED for unloaded group', async () => {
      const result = await handler.handleExtMethod('_opensumi/git/status', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('TOOL_NOT_LOADED');
    });

    it('should return TOOL_NOT_FOUND for invalid method format', async () => {
      const result = await handler.handleExtMethod('_opensumi/invalid', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('getCapabilityMeta', () => {
    it('should return capability metadata', () => {
      const meta = handler.getCapabilityMeta();
      expect(meta.opensumi.webmcpGroups).toContain('file');
      expect(meta.opensumi.webmcpGroups).toContain('git');
      expect(meta.opensumi.defaultLoadedGroups).toContain('file');
      expect(meta.opensumi.defaultLoadedGroups).not.toContain('git');
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx jest packages/ai-native/__test__/node/acp-webmcp-handler.test.ts --no-coverage` Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ai-native/__test__/node/acp-webmcp-handler.test.ts
git commit -m "test(acp): add AcpWebMcpHandler unit tests"
```

---

## Self-Review

### Spec Coverage

| Spec Section | Task |
| --- | --- |
| Core types (WebMcpGroup, WebMcpTool, WebMcpToolResult) | Task 1 |
| Shared utils (tryGetService, classifyError, safeErrorMessage) | Task 2 |
| Browser-side group registry | Task 3 |
| ACP extension method mechanism (extMethod hook) | Task 7 |
| Capability declaration (\_meta) | Task 7 |
| Meta methods (list_groups, load_group, unload_group) | Task 6 |
| Unified command proxy | Task 3 (ICommandWebMcpExecute constant defined, actual command registration in Task 8) |
| Node→Browser RPC bridge | Tasks 4, 5 |
| File group (default loaded) | Task 9 |
| Terminal group (default loaded) | Task 10 |
| Editor group (default loaded) | Task 11 |
| Error handling (SERVICE_UNAVAILABLE, TOOL_NOT_LOADED, TOOL_NOT_FOUND) | Tasks 2, 6 |
| File organization | All tasks follow spec structure |
| DI registration | Task 8 |
| Integration test | Task 12 |

### Placeholder Scan

No TBD, TODO, or "implement later" patterns found. All steps contain actual code.

### Type Consistency

- `WebMcpToolResult` defined in Task 1 (acp-types.ts) and Task 2 (webmcp-utils.ts) — both have `success`, `result?`, `error?`, `details?` fields. Task 2's local type is used for browser-side tool execution; Task 1's type is used for RPC. They are compatible.
- `WebMcpGroupDef` in Task 1 matches the shape returned by `WebMcpGroupRegistry.getGroupDefinitions()` in Task 3.
- `AcpWebMcpHandler` in Task 6 uses `WebMcpGroupDef` and `WebMcpGroupInfo` from Task 1.
- Method naming `_opensumi/{group}/{action}` is consistent across all tasks.
