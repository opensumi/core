# Scenario: ACP Chat Agentic Permission During Send - Dialog, Badge, Recovery

**Trigger:** `packages/ai-native/src/browser/acp/permission-bridge.service.ts`, `packages/ai-native/src/browser/acp/permission-dialog-container.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/node/acp/permission-routing.service.ts`

**Layer:** `runtime-ui` **Required profile:** `full` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=permission` for pending-dialog assertions, a `--fixture=stream-rich` pass is available for normal-send recovery checks, active session has stable permission dialog selectors, and a fresh MCP session is connected. A real LLM-backed ACP agent/prompt combination may be used only when it reliably triggers a visible permission request. **Workspace mutation:** None. **Automation status:** Converted to `tools/playwright/src/tests/permission-dialog.test.ts` for the deterministic `permission` fixture, full WebMCP profile, active badge/count observability, visible close/reject dismissal, and post-dismiss editable input. Live-agent runs may cover observable permission flow only when the prompt/agent reliably triggers permission.

## Given

- Agentic AI Chat is visible and the mock `permission` fixture can trigger a pending permission during a send.
- Permission decisions are performed only through visible browser UI.
- No ACP/WebMCP tool is used to approve or reject the permission request.

## When

1. Record `acp_chat_get_permission_state({})` before send.
2. Send the deterministic permission prompt through the Agentic input.
3. Wait until the permission dialog is visible while the request is still active.
4. Record active dialog count, history badge count, active session id, input disabled state, visible dialog text presence, and the browser tab title.
5. Click the visible Reject or close control.
6. Wait until the dialog is dismissed and the input is editable.
7. Record `acp_chat_get_permission_state({})`, visible error/recovery UI, row counts, history badge state, and the browser tab title.
8. If the permission fixture supports a non-permission follow-up in the same process, send it in the same session. Otherwise, restart the mock agent with `--fixture=stream-rich` and record normal-send recovery as a separate fixture pass.

## Then

- Pending permission is visible in both browser dialog UI and permission count metadata.
- While permission is pending on Web Agentic Layout, the browser tab title shows `(<count>) permission <base title>`.
- The active chat/session badge is scoped to the session that requested permission.
- Dismissing permission through UI clears the active dialog count.
- After dismissal, the browser tab title no longer has the permission prefix.
- The input does not stay disabled after permission dismissal.
- The rejected send leaves a recoverable visible state and does not create an empty duplicate session.
- A later normal send succeeds in the same session when the fixture supports per-prompt permission branching; otherwise the separate `stream-rich` recovery pass proves the UI can recover to normal send behavior after fixture reset.
- Permission state responses do not expose request content, file contents, approval options, or hidden decision tools.

## Live Agent Execution

- A real LLM-backed ACP agent may verify permission dialog observability, scoped badge/count metadata, UI-only dismissal, recovery, and metadata-only permission state when the live prompt reliably opens a dialog.
- Live-agent mode must not assert permission request body text, file contents, model-selected tool arguments, or generated recovery content. If no permission dialog appears, record the permission portion as blocked instead of passing it from a normal response.

## Pass / Fail Judgment

- **PASS** - permission during Agentic send is observable, dismissible through UI, scoped to the active session, and recoverable.
- **BLOCKED** - the run lacks full profile, the mock ACP agent `permission` fixture, or stable Reject/close selector.
- **FAIL** - permission content leaks through tools, the dialog cannot be dismissed, badges drift, or the chat remains stuck after dismissal.
