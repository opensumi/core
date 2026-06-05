# ACP BDD Suite

This folder contains BDD scenarios for the ACP module and the current ACP Chat capability group.

Primary source files:

- `packages/ai-native/src/node/acp/acp-agent.service.ts`
- `packages/ai-native/src/node/acp/acp-thread.ts`
- `packages/ai-native/src/node/acp/acp-cli-back.service.ts`
- `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`
- `packages/ai-native/src/node/acp/permission-routing.service.ts`
- `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts`
- `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`
- `packages/ai-native/src/browser/acp/permission-bridge.service.ts`
- `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

The old direct WebMCP ACP tools are no longer a runtime contract.

## Common Preflight

Use Chrome DevTools MCP to open a real browser against the IDE dev server:

```text
http://localhost:8080/?workspaceDir=<absolute workspace path>
```

The page is ready when Chrome DevTools MCP evaluation confirms:

```js
document.readyState === 'complete' &&
  !!document.querySelector('#main') &&
  !document.querySelector('.loading_indicator') &&
  document.body.innerText.includes('EXPLORER');
```

Chrome DevTools MCP is used for browser startup, DOM readiness, and dialog/UI observability. ACP tool execution in these scenarios uses the current OpenSumi MCP bridge. `navigator.modelContext` is still a supported WebMCP surface and is validated only where a scenario explicitly compares browser and MCP tool exposure.

## Tool Names

The canonical WebMCP tool name is the only external capability identifier. Each tool is registered once in the browser `WebMcpGroupRegistry` with `tool.name`, and both supported surfaces expose that same name:

- Browser: `navigator.modelContext.getTools()` / `registerTool()`
- Node: the built-in MCP `opensumi-ide` server `tools/list` / `tools/call`

Examples:

| Group      | Canonical tool name             |
| ---------- | ------------------------------- |
| `file`     | `file_read`                     |
| `search`   | `search_text`                   |
| `acp_chat` | `acp_chat_getSessionState`      |
| `acp_chat` | `acp_chat_getPermissionState`   |
| `acp_chat` | `acp_chat_showChatView`         |
| `acp_chat` | `acp_chat_listSessions`         |
| `acp_chat` | `acp_chat_getAvailableCommands` |
| `acp_chat` | `acp_chat_prepareSessionDigest` |
| `acp_chat` | `acp_chat_postPreparedRelay`    |
| `acp_chat` | `acp_chat_readSessionMessages`  |
| `acp_chat` | `acp_chat_setSessionMode`       |

There is no alias or fallback external name. Legacy `_opensumi/{group}/{action}` identifiers must not appear in `navigator.modelContext`, MCP `tools/list`, catalog descriptions, or fallback broker calls. BDD may mention them only in explicit negative tests that prove they are rejected.

Current MCP exposure:

- Default: `acp_chat_getSessionState`, `acp_chat_getPermissionState`, `acp_chat_showChatView`
- After enabling `acp_chat`: read/ui tools allowed by the active profile
- Full profile only: write tools such as `setSessionMode` and `postPreparedRelay`
- Current default profile after enabling `acp_chat`: read tools such as `listSessions`, `getAvailableCommands`, `prepareSessionDigest`, and `readSessionMessages`

## MCP Helper

Use the MCP client connected to the IDE's `opensumi-ide` server. Scenario steps refer to this shape:

```js
await mcp.callTool({ name: 'opensumi_discoverCapabilities', arguments: { task: 'acp chat state' } });
await mcp.callTool({ name: 'opensumi_enableCapabilityGroup', arguments: { group: 'acp_chat' } });
await mcp.callTool({ name: 'acp_chat_getSessionState', arguments: {} });
```

If the client cannot refresh `tools/list` after enabling the group, call through the fallback broker:

```js
await mcp.callTool({
  name: 'opensumi_invokeCapabilityTool',
  arguments: {
    tool: 'acp_chat_listSessions',
    arguments: {},
  },
});
```

The fallback broker must also tolerate common accidental nesting from agents and normalize it to the target tool's real arguments:

```js
await mcp.callTool({
  name: 'opensumi_invokeCapabilityTool',
  arguments: {
    tool: 'acp_chat_listSessions',
    arguments: {
      arguments: {},
    },
  },
});

await mcp.callTool({
  name: 'opensumi_invokeCapabilityTool',
  arguments: {
    arguments: {
      tool: 'acp_chat_listSessions',
      arguments: {},
    },
  },
});
```

If `tool` is missing or is not a string, the broker should return a structured invalid-arguments failure that points callers back to `{ tool: string, arguments?: object }`.

Startup logs for the built-in `opensumi-ide` MCP server must not print the full bridge URL or token. A log may include host and port, but the MCP token path must be redacted as `/mcp/<redacted>`.

## Scope Rules

- Do not use `acp_sendMessage`, `acp_createSession`, `acp_switchSession`, `acp_clearSession`, `acp_cancelRequest`, or `acp_handlePermissionDialog`. They are intentionally not registered in the current `acp_chat` group.
- Permission scenarios must observe pending permission state and DOM, but must not approve or reject permission through an ACP tool.
- Session-mode scenarios must verify that a successful mode switch is observable through session state. A response from `setSessionMode` alone is not enough.
- ACP Chat scenarios must not assert prompt text, assistant response text, or tool-call result content in `getSessionState`, `listSessions`, or permission state responses.
- File/editor/terminal BDD belongs to those capability groups, not to ACP Chat.

## Current Scenarios

- `bdd-runtime-preflight.scenario.md`: browser readiness, ModelContext/MCP bridge availability, and blocked-run diagnostics.
- `acp-agent-session-lifecycle.scenario.md`: node-side session creation, loading, streaming, cancellation, disposal, and thread-pool behavior.
- `acp-session-advanced-operations.scenario.md`: node-side config option, fork, resume, close, model selection, and available-mode operations.
- `acp-thread-pool-lru.scenario.md`: ACP thread-pool LRU recycling, evicted session reload, create/load race handling, and failure diagnostics.
- `acp-agent-protocol-client.scenario.md`: ACP protocol handshake, status machine, notification filtering, and entry conversion.
- `acp-mcp-bridge.scenario.md`: built-in `opensumi-ide` MCP bridge startup, injection, catalog, profile exposure, and session-scoped enabling.
- `acp-permission-routing.scenario.md`: node permission routing and browser permission bridge lifecycle.
- `acp-process-config.scenario.md`: browser config merge and node spawn config resolution.
- `acp-client-handlers.scenario.md`: ACP client file and terminal handlers exposed to the agent process.
- `acp-chat-session-storage.scenario.md`: browser chat session provider, session activation, fallback, command propagation, and permission cleanup.
- `acp-chat.scenario.md`: default ACP Chat smoke and safe observability.
- `acp-chat-agentic-layout.scenario.md`: Agentic layout ACP Chat runtime capability coverage, draft session lifecycle, safe tool surface, editor interop, resize/reload/switch regression, and fallback behavior.
- `available-commands.scenario.md`: command metadata through enabled group.
- `session-mode.scenario.md`: full-profile mode switching plus mode observability.
- `permission-dialog.scenario.md`: permission state and dialog observability without automated decisions.
- `session-relay.scenario.md`: cross-session digest relay safety contract.
- `error-handling.scenario.md`: capability boundaries and invalid inputs.
- `webmcp-capability-surface.scenario.md`: browser and MCP surfaces expose the same canonical tool names from the shared registry.
- `webmcp-ide-capability-groups.scenario.md`: workspace, search, diagnostics, file, terminal, and editor WebMCP group coverage.

## Deleted Scenarios

The following scenarios were removed because they target capabilities that are no longer part of the ACP Chat runtime contract:

- `message-flow.scenario.md`: required `acp_sendMessage`.
- `cancel-request.scenario.md`: required `acp_cancelRequest`.
- `session-lifecycle.scenario.md`: required create/switch/clear session tools.
- `file-operations.scenario.md`: belongs to the file capability group, not ACP.
- `chat-view.scenario.md`: covered by `acp_chat_showChatView`.
- `regression-core.scenario.md`: mixed unrelated groups and old direct tools.
- `background-permission-notification.scenario.md`: required old permission tools.
- `acp-agent-path-config.scenario.md`: not observable through ACP Chat WebMCP.
