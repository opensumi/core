# Scenario: ACP Chat Agentic Debug Log From Chat - Trace Viewer Correlation

**Trigger:** `packages/ai-native/src/node/acp/acp-debug-log.ts`, `packages/ai-native/src/browser/acp/debug-log/acp-debug-log.view.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/node/acp/acp-cli-back.service.ts`

**Layer:** `runtime-ui` **Required profile:** `full` with ACP debug logging enabled. **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich` for a deterministic ACP stream, or a real LLM-backed ACP agent is used only for live redacted-log smoke coverage, debug log store/viewer, and command `ai.native.acp.openDebugLog`. **Workspace mutation:** None. **Automation status:** Automated through Playwright/Chrome DevTools MCP and command execution. The viewer and Copy All share the product redaction contract; live-agent evidence must not include real secrets.

## Given

- ACP debug logging is enabled by the active test profile.
- Agentic AI Chat can send a deterministic `stream-rich` mock-agent stream that includes content, tool call, and completion updates.

## When

1. Send the deterministic debug-log prompt through Agentic AI Chat.
2. Wait for the stream to complete.
3. Execute `ai.native.acp.openDebugLog`.
4. Wait for the `ACP Debug Log` editor/viewer.
5. Click Refresh.
6. Record entries grouped by thread id, session id, direction, and a locally bounded redacted preview for evidence.
7. Click Copy All when entries exist.
8. Search copied text for MCP token paths, API keys, full permission prompts, full relay digests, and raw prompt/assistant sentinel content that must be redacted.
9. Click Clear and verify the viewer empty state.

## Then

- The debug log viewer opens as a normal editor/view, not a modal blocking chat.
- Entries correlate to the chat session/thread.
- Refresh, Copy All, and Clear work after a real Agentic chat stream.
- Copied/debug-rendered text redacts MCP tokens, API keys, permission content, relay digest bodies, raw prompt/assistant content, and tool arguments/results.
- Clearing the debug log does not clear chat history or active session state.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that a live chat stream creates debug log entries, that the viewer opens, and that Refresh, Copy All, and Clear remain usable.
- Live-agent mode must redact evidence and must not assert generated assistant text, raw prompt bodies, model tool arguments/results, API keys, MCP token paths, or permission content. Redaction/copy hardening requires a product redaction contract or synthetic fixtures.

## Pass / Fail Judgment

- **PASS** - a real Agentic chat stream creates useful correlated debug log entries, viewer controls work, and render/copy output is redacted.
- **BLOCKED** - the run lacks full profile, debug logging, viewer command, the mock ACP agent `stream-rich` fixture, or clipboard observability.
- **FAIL** - viewer cannot correlate entries, controls fail, logs grow beyond the store entry limit, or the redaction audit runs and copied text leaks secrets/sensitive content.
