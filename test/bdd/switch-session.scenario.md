# Scenario: Switch session from history

**Trigger:** `**/components/ChatHistory.tsx` or `**/components/AcpChatHistory.tsx` or `**/acp-session-provider.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available
- At least two sessions exist

## When

1. `webmcp`: acp_createSession → capture sessionA
2. `webmcp`: acp_createSession → capture sessionB
3. `webmcp`: acp_getSessionState → confirm current sessionId = sessionB
4. `cdp-click`: [data-testid="acp-chat-history-button"]
5. `cdp-wait`: [data-testid="acp-chat-history-popover"] visible
6. `cdp-click`: [data-testid="acp-chat-history-item-{sessionA}"]
7. `webmcp`: acp_getSessionState → confirm current sessionId = sessionA

## Then

- Step 7 returned sessionId equals sessionA
- Active session has switched from sessionB to sessionA
