# ACP Chat Multi-Workspace Support

## Problem

ACP Chat currently hardcodes `workspaceDir` from `this.workspaceService.workspace?.uri`, which only returns a single workspace root. In multi-root workspace scenarios, users cannot choose which workspace directory the ACP agent should operate in.

The terminal already solves this by showing a QuickPick dialog when `isMultiRootWorkspaceOpened` is true.

## Requirements

- Multi-root workspace: show QuickPick to let users select a workspace path during ACP agent initialization
- Single workspace: use the workspace root automatically (no change from current behavior)
- No caching: prompt every time the agent initializes
- Cancel handling: fall back to the first workspace root and notify the user

## Design

### New utility: `pickWorkspaceDir()`

Create a shared utility function that encapsulates the workspace selection logic. This function will be used by both `ACPSessionProvider` and `AcpChatAgent`.

**Location:** `packages/ai-native/src/browser/chat/pick-workspace-dir.ts`

```typescript
import { QuickPickService } from '@opensumi/ide-core-browser';
import { URI, formatLocalize, localize } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

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

### Changes to `ACPSessionProvider`

**File:** `packages/ai-native/src/browser/chat/acp-session-provider.ts`

1. Inject `QuickPickService`
2. Replace all `new URI(this.workspaceService.workspace?.uri).codeUri.fsPath` calls with `await pickWorkspaceDir(this.workspaceService, this.quickPick, this.messageService)`
3. Affected methods: `createSession()`, `loadSessions()`, `loadSession()`

### Changes to `AcpChatAgent`

**File:** `packages/ai-native/src/browser/chat/acp-chat-agent.ts`

1. Inject `QuickPickService`
2. In `invoke()`, replace the inline `workspaceDir` resolution with `await pickWorkspaceDir(...)`

### i18n strings

**Files:**

- `packages/i18n/src/common/en-US.lang.ts`
- `packages/i18n/src/common/zh-CN.lang.ts`

New keys:

- `chat.selectCWDForACP`: "Select working directory for AI chat" / "为 AI 对话选择工作路径"
- `chat.defaultCWDSelected`: "No directory selected, using default: {0}" / "未选择路径，默认使用：{0}"

## Files to modify

| File | Change |
| --- | --- |
| `packages/ai-native/src/browser/chat/pick-workspace-dir.ts` | **New file** — shared utility function |
| `packages/ai-native/src/browser/chat/acp-session-provider.ts` | Inject QuickPickService, use `pickWorkspaceDir()` in 3 methods |
| `packages/ai-native/src/browser/chat/acp-chat-agent.ts` | Inject QuickPickService, use `pickWorkspaceDir()` in `invoke()` |
| `packages/i18n/src/common/en-US.lang.ts` | Add 2 i18n keys |
| `packages/i18n/src/common/zh-CN.lang.ts` | Add 2 i18n keys |

## Behavior summary

| Scenario                 | Behavior                                     |
| ------------------------ | -------------------------------------------- |
| Single workspace         | Use workspace root automatically (unchanged) |
| Multi-root, user selects | Use selected path                            |
| Multi-root, user cancels | Use first root, show info message            |
| No workspace             | Use undefined (existing fallback behavior)   |
