# Scenario: Send message and receive reply

**Trigger:** `**/acp-chat-agent.ts` or `**/chat/chat.view.acp.tsx`

## Given

- Browser is at http://localhost:8080
- WebMCP is available

## When

1. `webmcp`: acp_createSession → capture sessionId
2. `webmcp`: acp_sendMessage({ sessionId, message: "hello" })
3. `cdp-wait`: assistant message appears
4. `cdp-snapshot`: get message list

## Then

- CDP take_snapshot tree contains user message "hello"
- CDP take_snapshot tree contains assistant reply content
- `webmcp`: acp_getSessionState returns threadStatus = "awaiting_prompt"
