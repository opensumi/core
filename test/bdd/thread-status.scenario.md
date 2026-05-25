# Scenario: Thread status shows in history list

**Trigger:** `**/acp/components/AcpChatHistory.tsx` or `**/acp/acp-agent.service.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available (`navigator.modelContext` exists)

## When

1. `webmcp`: acp_createSession → capture sessionId
2. `webmcp`: acp_sendMessage({ sessionId, message: "test" })
3. `cdp-wait`: "Chat History" text visible
4. `cdp-click`: [data-testid="acp-chat-history-button"]
5. `cdp-wait`: [data-testid="acp-chat-history-popover"] visible
6. `cdp-evaluate`: document.querySelector('[data-testid="thread-status-{sessionId}"]').textContent

## Then

- Step 6 result contains "working" or "awaiting_prompt" or "idle"
- History list contains the session item
