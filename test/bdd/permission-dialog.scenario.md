# Scenario: Permission dialog auto-approval

**Trigger:** `**/permission-dialog-widget.tsx` or `**/acp/permission-routing.service.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available
- An active ACP session exists

## When

1. `webmcp`: acp_sendMessage({ message: "create a file" }) — triggers permission request
2. `webmcp`: acp_getPermissionDialogState → confirm activeDialogCount > 0
3. `webmcp`: acp_handlePermissionDialog({ optionId: "allow_once" })
4. `cdp-wait`: permission dialog disappears (wait for [data-testid="acp-permission-dialog"] absence)

## Then

- CDP evaluate_script querying [data-testid="acp-permission-dialog"] returns null
- `webmcp`: acp_getPermissionDialogState returns activeDialogCount = 0
