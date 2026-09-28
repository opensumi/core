# Scenario: ACP Chat Agentic Agent-Cwd File Link Resolution

**Trigger:** `packages/ai-native/src/browser/components/ChatMarkdown.tsx`, `packages/ai-native/src/browser/components/ChatReply.tsx`, `packages/ai-native/src/browser/chat/chat.view.tsx`, or `packages/ai-native/src/browser/chat/chat.view.acp.tsx`.

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** A disposable IDE Workspace plus a second disposable agent-home directory registered as a Known Workspace Target; the mock ACP agent uses `--fixture=file-link-agent-cwd`; the agent-home directory contains `notes/agent-note.md` and the IDE workspace contains a distinct decoy `notes/agent-note.md`. **Workspace mutation:** Fixture setup creates disposable temp directories and files only. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-agent-cwd-file-link.test.ts` using `fixture=file-link-agent-cwd`, `profile=interactive`, and the loopback e2e project-seeding hook `__OPENSUMI_E2E__.addAgenticProject` (same pattern as `disposeAcpSessions`). Component-contract coverage additionally runs in Jest via `packages/ai-native/__test__/browser/chat-markdown-file-link.test.tsx` and `packages/ai-native/__test__/browser/chat/chat-reply.test.tsx`.

## Given

- Common preflight in `test/bdd/README.md` passes through Playwright.
- Agentic AI Chat is visible with the deterministic mock ACP agent registered.
- An agent-home directory exists inside the disposable IDE Workspace and is a Known Workspace Target, so its Project Group renders in the Agent Session Browser.
- The agent-home directory contains `notes/agent-note.md` with a distinctive marker; the IDE workspace root contains a **different** decoy `notes/agent-note.md` so wrong resolution is observable.
- A new Agent Session is launched from the agent-home Project Group, so its Workspace Target (`acpTarget.cwd`) is the agent-home directory while the IDE Workspace remains the workspace root.

## When

1. Launch a new session from the agent-home Project Group `+` action.
2. Wait for the client to finish binding the background draft session (the swap started by `prepareDraftBoundSession` when the draft was entered) before sending.
3. Send a deterministic prompt and wait for `BDD_AGENT_CWD_FILE_LINK_READY`.
4. Record the assistant message links: a plain relative `notes/agent-note.md` and an inline-code `notes/agent-note.md:1:1`.
5. Record the Agentic Chat header Agent Execution Context Indicator for the agent-home Workspace Target.
6. Click the plain relative file link.
7. Record the opened editor tab URI and visible content.
8. In a second pass, launch a session from the current IDE Workspace Project Group with the same fixture and click the same relative link.

## Then

- The assistant renders the relative path as a file link whose href resolves against the session's `acpTarget.cwd` (agent-home), not the IDE workspace root.
- Clicking the link opens `agent-home/notes/agent-note.md` in the editor with the agent-home marker content; the decoy workspace-root copy is not opened.
- The Agent Execution Context Indicator shows the agent-home Workspace Target while the IDE Workspace stays unchanged.
- A session whose Workspace Target equals the IDE Workspace resolves the same relative link against the workspace root (fallback parity).
- Sessions without an `acpTarget` (classic chat) fall back to `appConfig.workspaceDir` (covered by the Jest component contract).

## Pass / Blocked Judgment

- **PASS** - relative assistant file links resolve against the active Agent Session cwd when it differs from the IDE Workspace, absolute/file URI links stay unchanged, and workspace-equal sessions keep workspace resolution.
- **BLOCKED** - the disposable workspaces, the agent-home project seeding hook, the deterministic `file-link-agent-cwd` fixture, or stable session/launch selectors are unavailable.
- **FAIL** - the link href or opened editor URI resolves against the IDE workspace root while the session cwd differs, the execution context indicator is missing for a differing target, or the fallback behavior regresses.

## Codegen Plan

- Keep the Playwright spec as the single hardened browser workflow; do not create duplicates. Jest component-contract files remain the node-contract surface for this scenario.

## Timing Notes

- An Agentic draft immediately starts a background draft-bound session (`prepareDraftBoundSession` in `chat.internal.service.acp.ts`). Clicking send inside that swap window used to be silently swallowed (the send button's onClick was removed while `submitDisabled` held `sessionLoading`), so the spec waits for the bound session to exist before sending. The product now keeps the send affordance active during the creation window: the submitted turn is reserved by the queued-turn runtime ("Starting task…") and dispatches automatically once the session binds (`acp-chat-agentic-send-during-session-creation.test.ts`). The `waitForDraftBoundSession` wait remains valid here: this spec asserts on the completed turn, and waiting keeps its timing independent of the hold window.
