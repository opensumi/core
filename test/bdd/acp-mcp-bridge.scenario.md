# Scenario: ACP Built-in MCP Bridge - Inject OpenSumi Capabilities Safely

**Trigger:** `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts` or `packages/ai-native/src/node/acp/acp-agent.service.ts`

## Given

- The agent is initialized and reports `mcpCapabilities.http === true`.
- `OpenSumiMcpHttpServer` can start on loopback.
- WebMCP group definitions are available from the browser caller service.
- The active MCP profile is recorded from the group registry metadata.

## When

### Part A - Server Startup And Injection

1. `AcpAgentService.createSession(config)` is called.
2. `getSessionMcpServers` filters user configured MCP servers against agent MCP capabilities.
3. `OpenSumiMcpHttpServer.start()` is called if HTTP MCP is supported.
4. `newSession` receives configured MCP servers plus the built-in `opensumi-ide` HTTP MCP server.
5. Inspect node logs emitted during MCP server startup.

### Part B - MCP Transport And Catalog

6. Connect an MCP client to the bridge URL.
7. Call `tools/list`.
8. Call `opensumi_discoverCapabilities({ task, includeDisabled: true })`.
9. Call `opensumi_describeCapabilityGroup({ group: "acp_chat", includeSchemas: true })`.
10. Call `opensumi_describeTool({ tool: "acp_chat_getSessionState" })`.
11. Call `opensumi_describeTool({ tool: "_opensumi/acp_chat/getSessionState" })`.

### Part C - Session-Scoped Enablement

12. In client A, call `opensumi_enableCapabilityGroup({ group: "acp_chat" })`.
13. Refresh `tools/list` for client A.
14. Connect client B as a fresh MCP session and call `tools/list`.
15. In client A, call an enabled ACP read tool directly or through `opensumi_invokeCapabilityTool`.
16. In client A, call the same enabled ACP read tool through `opensumi_invokeCapabilityTool` with the common accidental nested shape:

```json
{
  "tool": "acp_chat_listSessions",
  "arguments": {
    "arguments": {}
  }
}
```

17. In client A, call the same enabled ACP read tool through `opensumi_invokeCapabilityTool` with the whole invocation nested under `arguments`:

```json
{
  "arguments": {
    "tool": "acp_chat_listSessions",
    "arguments": {}
  }
}
```

18. In client A, call `opensumi_invokeCapabilityTool` without a string `tool`.
19. In client B, call the same non-default tool through `opensumi_invokeCapabilityTool` before enabling.

### Part D - Profile Exposure

20. In default profile, inspect tools exposed after enabling `acp_chat`.
21. In full profile, inspect tools exposed after enabling `acp_chat`.

## Then

- The bridge listens only on `127.0.0.1` with an unguessable `/mcp/<token>` path.
- User-visible node logs must not include the full bridge URL or token; startup logs may include the loopback host/port but must redact the path as `/mcp/<redacted>`.
- Requests with the wrong path or non-loopback host are rejected.
- If the agent does not support HTTP MCP, the built-in server is not injected.
- If a configured MCP server already uses the built-in server name, the built-in server is not duplicated.
- `tools/list` includes canonical underscore tool names only.
- Catalog tools describe groups and tools without exposing file/chat contents.
- Legacy `_opensumi/...` names return `TOOL_NOT_FOUND` or equivalent failure.
- Enabling a group is scoped to the current MCP transport session; client B does not inherit client A's enabled groups.
- In default profile after enabling `acp_chat`, read/ui tools are exposed, including `acp_chat_readSessionMessages`, but write tools remain hidden.
- In full profile after enabling `acp_chat`, write tools such as `acp_chat_setSessionMode` and `acp_chat_postPreparedRelay` are exposed.
- `opensumi_invokeCapabilityTool` accepts the canonical fallback shape and the two common accidental nested shapes, normalizing all of them to the target tool's actual arguments before execution.
- `opensumi_invokeCapabilityTool` without a valid string `tool` fails with `INVALID_ARGUMENTS` or equivalent structured failure and explains the expected `{ tool: string, arguments?: object }` shape.
- Calling a non-default tool before enablement fails with `CAPABILITY_NOT_ENABLED` or equivalent structured failure.

## Pass / Fail Judgment

- **PASS** - the bridge is loopback/token scoped, injects only when supported, redacts secrets in logs, exposes canonical tools, normalizes fallback broker arguments, and enforces session-scoped enablement/profile visibility.
- **FAIL** - bridge URLs or tokens leak in logs, legacy aliases work, nested fallback arguments are passed through incorrectly, enabled groups leak across MCP sessions, or write tools are exposed outside full profile.
