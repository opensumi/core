# Scenario: Message flow — send, receive, verify state

**Trigger:** `**/chat/chat.api.service.ts` or `**/chat/chat-manager.service.acp.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available (`navigator.modelContext` exists)
- ACP tools registered: `acp_createSession`, `acp_sendMessage`, `acp_getSessionState`

## When

1. `webmcp`: `acp_createSession` → capture `sessionId`
2. `webmcp`: `acp_getSessionState` → record initial state (requestCount = 0, threadStatus = "idle")
3. `webmcp`: `acp_sendMessage({ sessionId: "{sessionId}", message: "hello" })`
4. `webmcp`: `acp_getSessionState` → check state after sending (within 5s)
5. Wait 15 seconds for agent response
6. `webmcp`: `acp_getSessionState` → check final state
7. `cdp-snapshot`: capture current page accessibility tree

## Then

- Step 2: threadStatus = "idle", requestCount = 0
- Step 3: returns `status: "message_sent"`
- Step 4: requestCount >= 1 (message queued), threadStatus transitions to "working"
- Step 6: requestCount >= 1, threadStatus = "awaiting_prompt" (agent responded)
- Step 7: CDP snapshot does not show error state in chat panel
