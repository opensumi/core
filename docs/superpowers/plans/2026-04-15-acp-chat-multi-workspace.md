# ACP Chat Multi-Workspace Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable ACP Chat to prompt users to select a workspace directory in multi-root workspace scenarios, matching the terminal's existing behavior.

**Architecture:** Add a shared `pickWorkspaceDir()` utility that uses `QuickPickService` + `IWorkspaceService` to resolve the working directory. Replace hardcoded `workspace?.uri` lookups in `ACPSessionProvider` and `AcpChatAgent` with calls to this utility.

**Tech Stack:** TypeScript, OpenSumi DI (`@opensumi/di`), `QuickPickService`, `IWorkspaceService`

**Spec:** `docs/superpowers/specs/2026-04-15-acp-chat-multi-workspace-design.md`

---

### Task 1: Add i18n strings

**Files:**

- Modify: `packages/i18n/src/common/en-US.lang.ts:1080`
- Modify: `packages/i18n/src/common/zh-CN.lang.ts:726`

- [ ] **Step 1: Add English i18n strings**

In `packages/i18n/src/common/en-US.lang.ts`, find line 1080:

```typescript
    'terminal.selectCWDForNewTerminal': 'Select current working directory for new terminal',
```

Add the following two lines after it:

```typescript
    'chat.selectCWDForACP': 'Select working directory for AI chat',
    'chat.defaultCWDSelected': 'No directory selected, using default: {0}',
```

- [ ] **Step 2: Add Chinese i18n strings**

In `packages/i18n/src/common/zh-CN.lang.ts`, find line 726:

```typescript
    'terminal.selectCWDForNewTerminal': '为新 terminal 选择当前工作路径',
```

Add the following two lines after it:

```typescript
    'chat.selectCWDForACP': '为 AI 对话选择工作路径',
    'chat.defaultCWDSelected': '未选择路径，默认使用：{0}',
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/src/common/en-US.lang.ts packages/i18n/src/common/zh-CN.lang.ts
git commit -m "feat(acp): add i18n strings for multi-workspace directory selection"
```

---

### Task 2: Create `pickWorkspaceDir` utility

**Files:**

- Create: `packages/ai-native/src/browser/chat/pick-workspace-dir.ts`

- [ ] **Step 1: Create the utility file**

Create `packages/ai-native/src/browser/chat/pick-workspace-dir.ts` with the following content:

```typescript
import { QuickPickService } from '@opensumi/ide-core-browser';
import { URI, formatLocalize, localize } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

/**
 * Resolve the workspace directory for ACP operations.
 * In multi-root workspace mode, prompts the user to select a workspace root via QuickPick.
 * In single workspace mode, returns the workspace root directly.
 */
export async function pickWorkspaceDir(
  workspaceService: IWorkspaceService,
  quickPick: QuickPickService,
  messageService: IMessageService,
): Promise<string | undefined> {
  await workspaceService.whenReady;

  if (workspaceService.isMultiRootWorkspaceOpened) {
    const roots = workspaceService.tryGetRoots();
    const choose = await quickPick.show(
      roots.map((file) => new URI(file.uri).codeUri.fsPath),
      { placeholder: localize('chat.selectCWDForACP') },
    );
    if (choose) {
      return choose;
    }
    // User cancelled: fall back to first root and notify
    const fallback = new URI(roots[0].uri).codeUri.fsPath;
    messageService.info(formatLocalize('chat.defaultCWDSelected', fallback));
    return fallback;
  }

  if (workspaceService.workspace) {
    return new URI(workspaceService.workspace.uri).codeUri.fsPath;
  }

  return undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ai-native/src/browser/chat/pick-workspace-dir.ts
git commit -m "feat(acp): add pickWorkspaceDir utility for multi-workspace selection"
```

---

### Task 3: Update `ACPSessionProvider` to use `pickWorkspaceDir`

**Files:**

- Modify: `packages/ai-native/src/browser/chat/acp-session-provider.ts`

- [ ] **Step 1: Add imports and inject QuickPickService**

In `packages/ai-native/src/browser/chat/acp-session-provider.ts`, add `QuickPickService` to the imports from `@opensumi/ide-core-browser`:

```typescript
import { PreferenceService, QuickPickService } from '@opensumi/ide-core-browser';
```

Add the import for `pickWorkspaceDir`:

```typescript
import { pickWorkspaceDir } from './pick-workspace-dir';
```

Inside the `ACPSessionProvider` class, add the injection after the existing `@Autowired` declarations (e.g., after the `messageService` injection around line 33):

```typescript
  @Autowired(QuickPickService)
  private readonly quickPick: QuickPickService;
```

- [ ] **Step 2: Update `createSession` method**

In the `createSession` method (around line 48-49), replace:

```typescript
const result = await this.aiBackService.createSession({
  workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
  ...agentConfig,
});
```

with:

```typescript
const workspaceDir = await pickWorkspaceDir(this.workspaceService, this.quickPick, this.messageService);
const result = await this.aiBackService.createSession({
  workspaceDir,
  ...agentConfig,
});
```

- [ ] **Step 3: Update `loadSessions` method**

In the `loadSessions` method (around line 95-96), replace:

```typescript
const result = await this.aiBackService.listSessions({
  workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
  ...agentConfig,
});
```

with:

```typescript
const workspaceDir = await pickWorkspaceDir(this.workspaceService, this.quickPick, this.messageService);
const result = await this.aiBackService.listSessions({
  workspaceDir,
  ...agentConfig,
});
```

- [ ] **Step 4: Update `loadSession` method**

In the `loadSession` method (around line 154-156), replace:

```typescript
const config: AgentProcessConfig = {
  ...agentConfig,
  workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
};
```

with:

```typescript
const workspaceDir = await pickWorkspaceDir(this.workspaceService, this.quickPick, this.messageService);
const config: AgentProcessConfig = {
  ...agentConfig,
  workspaceDir,
};
```

- [ ] **Step 5: Remove unused URI import if no longer needed**

Check if `URI` is still used elsewhere in the file. If not, remove it from the import statement. Currently `URI` is imported from `@opensumi/ide-core-common` — it is still used in the `AgentProcessConfig` type import line, so it likely stays. Verify and adjust.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-native/src/browser/chat/acp-session-provider.ts
git commit -m "feat(acp): use pickWorkspaceDir in ACPSessionProvider for multi-workspace support"
```

---

### Task 4: Update `AcpChatAgent` to use `pickWorkspaceDir`

**Files:**

- Modify: `packages/ai-native/src/browser/chat/acp-chat-agent.ts`

- [ ] **Step 1: Add imports and inject QuickPickService**

In `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, add `QuickPickService` to the imports. Add this import line:

```typescript
import { QuickPickService } from '@opensumi/ide-core-browser';
```

Add the import for `pickWorkspaceDir`:

```typescript
import { pickWorkspaceDir } from './pick-workspace-dir';
```

Inside the `AcpChatAgent` class, add the injection (e.g., after the `workspaceService` injection around line 71):

```typescript
  @Autowired(QuickPickService)
  private readonly quickPick: QuickPickService;
```

- [ ] **Step 2: Update `invoke` method**

In the `invoke` method (around lines 165-172), replace the inline `agentSessionConfig` construction:

```typescript
          agentSessionConfig: (() => {
            const agentType = getDefaultAgentType(this.preferenceService);
            const agentConfig = getAgentConfig(this.preferenceService, agentType);
            return {
              ...agentConfig,
              workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
            };
          })(),
```

with a pre-resolved value. Move the workspace resolution before the `requestStream` call:

```typescript
const agentType = getDefaultAgentType(this.preferenceService);
const agentConfig = getAgentConfig(this.preferenceService, agentType);
const workspaceDir = await pickWorkspaceDir(this.workspaceService, this.quickPick, this.messageService);
const stream = await this.aiBackService.requestStream(
  prompt,
  {
    requestId: request.requestId,
    sessionId,
    history: [lastmessage],
    images: request.images,
    ...(await this.getRequestOptions()),
    agentSessionConfig: {
      ...agentConfig,
      workspaceDir,
    },
  },
  token,
);
```

- [ ] **Step 3: Clean up unused URI import**

Check if `URI` is still used elsewhere in the file. If the only usage was in the `workspaceDir` line, remove `URI` from the import on line 13:

```typescript
import {
  AIBackSerivcePath,
  CancellationToken,
  ChatFeatureRegistryToken,
  Deferred,
  IAIBackService,
  IAIReporter,
  IApplicationService,
  IChatProgress,
  MCPConfigServiceToken,
} from '@opensumi/ide-core-common';
```

(Remove `URI` from the list if no longer needed.)

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/browser/chat/acp-chat-agent.ts
git commit -m "feat(acp): use pickWorkspaceDir in AcpChatAgent for multi-workspace support"
```

---

### Task 5: Verify compilation

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript compilation check**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json
```

Expected: No compilation errors.

- [ ] **Step 2: Fix any compilation issues if present**

If there are errors, fix the imports or type issues in the modified files.

- [ ] **Step 3: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve compilation errors from multi-workspace changes"
```
