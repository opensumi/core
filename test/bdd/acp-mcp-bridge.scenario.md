# Scenario: ACP Built-in MCP Bridge - Inject OpenSumi Capabilities Safely

**Trigger:** `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts` or `packages/ai-native/src/node/acp/acp-agent.service.ts`

**Layer:** `mcp-contract` **Required profile:** `default`, `interactive`, and `full` comparison runs. **Fixtures:** ACP agent with HTTP MCP support and fresh MCP transport sessions. **Workspace mutation:** None. **Automation status:** Automated MCP contract spec; no browser UI interaction is required.

## Given

- The agent is initialized and reports `mcpCapabilities.http === true`.
- `OpenSumiMcpHttpServer` can start on loopback.
- WebMCP group definitions are available from the browser caller service.
- The browser WebMCP surface exposes `opensumi_get_mcp_server_connection` for stable client discovery.
- The active MCP profile is recorded from the group registry metadata.

## When

### Part A - Server Startup And Injection

1. `AcpAgentService.createSession(config)` is called.
2. `getSessionMcpServers` filters user configured MCP servers against agent MCP capabilities.
3. `OpenSumiMcpHttpServer.start()` is called if HTTP MCP is supported.
4. `newSession` receives configured MCP servers plus the built-in `opensumi-ide` HTTP MCP server.
5. Inspect node logs emitted during MCP server startup.

### Part B - MCP Transport And Catalog

6. Discover the bridge URL with `opensumi_get_mcp_server_connection`, then connect an MCP client to the returned Streamable HTTP URL.
7. Call `tools/list`.
8. Call `opensumi_discover_capabilities({ task, includeDisabled: true })`.
9. Call `opensumi_describe_capability_group({ group: "acp_chat", includeSchemas: true })`.
10. Call `opensumi_describe_tool({ tool: "acp_chat_get_session_state" })`.
11. Call `opensumi_describe_tool({ tool: "_opensumi/acp_chat/getSessionState" })`.
12. Call `opensumi_describe_tool({ tool: "acp_chat_getSessionState" })`.

### Part C - Session-Scoped Enablement

13. In client A, call `opensumi_enable_capability_group({ group: "acp_chat" })`.
14. Refresh `tools/list` for client A.
15. Connect client B as a fresh MCP session and call `tools/list`.
16. In client A, call an enabled ACP read tool directly or through `opensumi_invoke_capability_tool`.
17. In client A, call the same enabled ACP read tool through `opensumi_invoke_capability_tool` with the common accidental nested shape:

```json
{
  "tool": "acp_chat_list_sessions",
  "arguments": {
    "arguments": {}
  }
}
```

18. In client A, call the same enabled ACP read tool through `opensumi_invoke_capability_tool` with the whole invocation nested under `arguments`:

```json
{
  "arguments": {
    "tool": "acp_chat_list_sessions",
    "arguments": {}
  }
}
```

19. In client A, call `opensumi_invoke_capability_tool` without a string `tool`.
20. In client B, call the same non-default tool through `opensumi_invoke_capability_tool` before enabling.

### Part D - Profile Exposure

21. In default profile, inspect tools exposed after enabling `acp_chat`.
22. In interactive profile, inspect tools exposed after enabling `acp_chat`.
23. In full profile, inspect tools exposed after enabling `acp_chat`.

### Part E - Transport Lifecycle

24. Issue a valid MCP request and record the returned `mcp-session-id`.
25. Send a follow-up request with the valid `mcp-session-id`.
26. Send a request with an unknown `mcp-session-id`.
27. Send `DELETE` with the valid `mcp-session-id`.
28. Send another request with the deleted `mcp-session-id`.

## Then

- The bridge listens only on `127.0.0.1` with an unguessable `/mcp/<token>` path.
- User-visible node logs must not include the full bridge URL or token; startup logs may include the loopback host/port but must redact the path as `/mcp/<redacted>`.
- Requests with the wrong path or non-loopback host are rejected.
- If the agent does not support HTTP MCP, the built-in server is not injected.
- If a configured MCP server already uses the built-in server name, the built-in server is not duplicated.
- `tools/list` includes canonical underscore tool names only.
- Catalog tools describe groups and tools without exposing file/chat contents.
- Legacy `_opensumi/...` and camelCase ACP Chat names return `TOOL_NOT_FOUND` or equivalent failure.
- Enabling a group is scoped to the current MCP transport session; client B does not inherit client A's enabled groups.
- In default profile after enabling `acp_chat`, only default-safe read/ui tools remain exposed.
- In interactive profile after enabling `acp_chat`, read tools such as `acp_chat_list_sessions`, `acp_chat_get_available_commands`, and `acp_chat_prepare_session_digest` are exposed, but full-profile debug/write tools remain hidden.
- In full profile after enabling `acp_chat`, full-profile tools such as `acp_chat_read_session_messages`, `acp_chat_set_session_mode`, and `acp_chat_post_prepared_relay` are exposed.
- `opensumi_invoke_capability_tool` accepts the canonical fallback shape and the two common accidental nested shapes, normalizing all of them to the target tool's actual arguments before execution.
- `opensumi_invoke_capability_tool` without a valid string `tool` fails with `INVALID_ARGUMENTS` or equivalent structured failure and explains the expected `{ tool: string, arguments?: object }` shape.
- Calling a non-default tool before enablement fails with `CAPABILITY_NOT_ENABLED` or equivalent structured failure.
- Unknown or deleted `mcp-session-id` requests return 404 and do not create a new transport implicitly.
- `DELETE` releases the transport and removes session-scoped enabled groups.

## Pass / Fail Judgment

- **PASS** - the bridge is loopback/token scoped, injects only when supported, redacts secrets in logs, exposes canonical tools, normalizes fallback broker arguments, and enforces session-scoped enablement/profile visibility.
- **FAIL** - bridge URLs or tokens leak in logs, legacy aliases work, nested fallback arguments are passed through incorrectly, enabled groups leak across MCP sessions, or write tools are exposed outside full profile.
