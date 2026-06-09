# Scenario: ACP Chat Agentic Error Taxonomy - Visible Recovery by Failure Class

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, `packages/ai-native/src/browser/chat/acp-session-provider.ts`, `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, or `packages/ai-native/src/node/acp/acp-agent.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent runs separate passes for `--fixture=create-failure`, `--fixture=load-failure`, `--fixture=send-failure`, `--fixture=auth-required`, `--fixture=config-failure`, and `--fixture=stream-rich` retry recovery, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. Disconnected coverage requires a separate process-exit harness if not supplied by the mock fixture. A real LLM-backed ACP agent may be used only for incidental live recovery observations when the environment naturally enters one of these states. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus safe state tools; deterministic mock-agent failure taxonomy fixtures are required for the full matrix and Playwright conversion.

## Given

- Agentic AI Chat is visible.
- Each failure mode is deterministic and can be reset before the next case by restarting the mock ACP agent with the next fixture name.
- Failure messages use stable sentinel text owned by the fixture.

## When

1. Run `--fixture=create-failure` and record visible error, input state, and session list state.
2. Reset and run `--fixture=load-failure` from history selection.
3. Reset and run `--fixture=send-failure` after a user row has rendered.
4. Reset and run `--fixture=auth-required`.
5. Reset and run the disconnected agent fixture if a process-exit harness is available; otherwise record this subcase as blocked.
6. Reset and run `--fixture=config-failure`.
7. After each failure, run `--fixture=stream-rich` and send a deterministic successful prompt.
8. Record `acp_chat_get_session_state({})` and browser console errors without secrets.

## Then

- Each failure class shows a user-visible, bounded, non-stack-trace error.
- Input and loading state recover after each failure.
- Create/load failures do not persist empty duplicate sessions.
- Send failures preserve the user row and allow retry.
- Auth-required/disconnected states are visible without making hidden mutation tools available.
- Successful retry clears stale failure UI.
- State tools and console diagnostics do not leak prompts, assistant content, API keys, MCP tokens, raw ACP JSON, or permission bodies.

## Live Agent Execution

- A real LLM-backed ACP agent may provide evidence for naturally occurring auth, disconnected, send, or config recovery states when those states are reproducible in the live environment.
- Live-agent mode must not substitute for forced create/load/send/auth/disconnect/config failure coverage. It must not assert generated assistant content or exact model error wording; the mock-agent failure taxonomy fixture passes remain required for a full PASS and conversion.

## Pass / Fail Judgment

- **PASS** - all deterministic ACP failure classes surface safe visible recovery and remain retryable.
- **BLOCKED** - the run lacks interactive profile or the required mock ACP agent failure fixture pass; disconnected is blocked unless a process-exit harness is available.
- **FAIL** - errors are silent, unbounded, leaking, unrecoverable, or leave stale session/loading state.
