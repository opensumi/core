# Scenario: Create new session

**Trigger:** `**/acp/acp-agent.service.ts` or related session management components

## Given

- Browser is at http://localhost:8080
- WebMCP is available

## When

1. `webmcp`: acp_createSession → capture sessionId
2. `webmcp`: acp_listSessions

## Then

- Step 2 result list contains the sessionId from step 1
- Session title is not empty
