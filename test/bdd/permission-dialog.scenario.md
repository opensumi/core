# Scenario: Permission dialog — detect and handle

**Trigger:** `**/acp/permission-bridge.service.ts` or `**/acp/webmcp-tools.registry.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available (`navigator.modelContext` exists)
- ACP tools registered: `acp_createSession`, `acp_sendMessage`, `acp_getPermissionDialogState`, `acp_handlePermissionDialog`

## When

1. `webmcp`: `acp_createSession` → capture `sessionId`
2. `webmcp`: `acp_getPermissionDialogState` → baseline: activeDialogCount = 0
3. `webmcp`: `acp_sendMessage({ sessionId: "{sessionId}", message: "create a file named test.txt with content 'hello'" })`
4. Wait 10 seconds for agent to process and potentially trigger permission request
5. `webmcp`: `acp_getPermissionDialogState` → check for active dialog
6. If `activeDialogCount > 0`:
   - `webmcp`: `acp_handlePermissionDialog({ requestId: "{requestId}", optionId: "allow_once" })`
7. `webmcp`: `acp_getPermissionDialogState` → verify dialog cleared

## Then

- Step 2: activeDialogCount = 0 (no pending dialogs initially)
- Step 5: if agent triggers file write, activeDialogCount >= 1, requestId is populated
- Step 6: permission dialog handled, returns requestId and optionId
- Step 7: activeDialogCount returns to 0 (dialog dismissed)
