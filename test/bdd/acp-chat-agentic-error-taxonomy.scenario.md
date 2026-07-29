# Scenario: ACP Chat Agentic Error Taxonomy - Visible Recovery by Failure Class

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, `packages/ai-native/src/browser/chat/acp-session-provider.ts`, `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, or `packages/ai-native/src/node/acp/acp-agent.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent runs separate passes for `--fixture=create-failure`, `--fixture=load-failure`, `--fixture=send-failure`, `--fixture=service-failure`, `--fixture=model-not-found`, `--fixture=auth-required`, `--fixture=config-failure`, `--fixture=process-exit`, and `--fixture=stream-rich` retry recovery, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. A real LLM-backed ACP agent may be used only for incidental live recovery observations when the environment naturally enters one of these states. **Workspace mutation:** None. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-error-taxonomy.test.ts` for deterministic create, load, send, OpenCode service, model-not-found, auth-required, config, and process-exit failure passes plus `stream-rich` recovery after each failure.

## Given

- Agentic AI Chat is visible.
- Each failure mode is deterministic and can be reset before the next case by restarting the mock ACP agent with the next fixture name.
- Failure messages use stable sentinel text owned by the fixture.

## When

1. Run `--fixture=create-failure` and record visible error, input state, and session list state.
2. 重置 fixture，将面板切换到 Classic 布局，并从 ACP 历史记录选择 seeded session 执行 `--fixture=load-failure`。Agentic 布局使用 Task List，不再把未注册为 Agent Task 的 ACP 历史会话作为选择入口。
3. Reset and run `--fixture=send-failure` after a user row has rendered.
4. Reset and run `--fixture=service-failure`; verify the raw `Internal error: OpenCode service failure` text is replaced with retry/new-session guidance and bounded `service`/`errorName` details.
5. Reset and run `--fixture=model-not-found`; verify the selected model id is visible with guidance to choose another model.
6. Reset and run `--fixture=auth-required`.
7. Reset and run `--fixture=process-exit` for the disconnected agent subcase.
8. Reset and run `--fixture=config-failure`.
9. After each failure, run `--fixture=stream-rich` and send a deterministic successful prompt.
10. Record `acp_chat_get_session_state({})` and browser console errors without secrets.

## Then

- Each failure class shows a user-visible, bounded, non-stack-trace error.
- Input and loading state recover after each failure.
- Create/load failures do not persist empty duplicate sessions.
- 历史加载失败子用例在提供 ACP 历史选择入口的 Classic 布局执行；失败后回到可输入草稿，并且不产生空的重复会话。
- Send failures preserve the user row and allow retry.
- Generic OpenCode service failures show retry and new-session guidance, include only bounded service/error-name diagnostics, and do not expose the raw JSON-RPC message.
- Invalid-model failures identify the unavailable model and tell the user to choose another model.
- Auth-required/disconnected states are visible without making hidden mutation tools available.
- Successful retry clears stale failure UI.
- State tools and console diagnostics do not leak prompts, assistant content, API keys, MCP tokens, raw ACP JSON, or permission bodies.

## Live Agent Execution

- A real LLM-backed ACP agent may provide evidence for naturally occurring auth, disconnected, send, or config recovery states when those states are reproducible in the live environment.
- Live-agent mode must not substitute for forced create/load/send/auth/disconnect/config failure coverage. It must not assert generated assistant content or exact model error wording; the mock-agent failure taxonomy fixture passes remain required for a full PASS and conversion.

## Pass / Fail Judgment

- **PASS** - all scheduled deterministic ACP failure classes surface safe visible recovery and remain retryable.
- **BLOCKED** - the run lacks interactive profile or a required mock ACP agent failure fixture pass.
- **FAIL** - errors are silent, unbounded, leaking, unrecoverable, or leave stale session/loading state.
