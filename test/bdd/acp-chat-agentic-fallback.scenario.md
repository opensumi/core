# Scenario: ACP Chat Agentic Fallback - Usable Surface Without ACP Backend

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatViewWrapper.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** IDE dev server with ACP backend readiness forced to fail by the local-loopback `acpBddBackendReadyFailure=reject` runtime fixture before chat initialization. **Workspace mutation:** None. **Automation status:** Automated through Playwright regression; Chrome DevTools MCP may be used for manual evidence.

## Given

- Common Preflight passes.
- The IDE is started in Agentic layout.
- ACP backend readiness fails deterministically before ACP chat initialization.

## When

1. Open the workspace in Agentic layout.
2. Show the AI Chat view through MCP or Chrome DevTools MCP.
3. Wait for the chat view to render without waiting for a real ACP session.
4. Record visible chat UI, fatal UI text, loading/retry text, and input focusability.
5. If the MCP bridge is available, call the default ACP Chat state tools.

## Then

- Agentic AI Chat still renders a usable chat surface through the local fallback path.
- The fallback path does not create an infinite loading state and does not require a real ACP session to render children.
- Hidden ACP mutation tools remain unavailable.
- ACP Chat state tools either return a structured service-unavailable result or safe metadata for the fallback session.
- No state or visible UI exposes uncaught stack traces, raw JSON-RPC payloads, MCP tokens, full prompt/message bodies, assistant text, or permission content outside allowed title metadata.

## Live Agent Execution

- A real LLM-backed ACP agent is not a substitute for this scenario, because the contract is the UI fallback when ACP backend readiness fails before chat initialization.
- Live-agent runs may verify the normal healthy path separately, but this scenario remains blocked until a backend-failure fixture or test provider can force readiness failure.

## Pass / Fail Judgment

- **PASS** - ACP backend failure still leaves a usable Agentic chat surface and structured safe state responses.
- **BLOCKED** - no deterministic backend-failure fixture is available.
- **FAIL** - the page enters infinite loading, fallback throws unstructured errors, hidden mutation tools appear, or sensitive content leaks.
