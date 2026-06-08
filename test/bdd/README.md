# ACP BDD Suite

This folder contains BDD scenarios and contract specs for the ACP module, ACP Chat, and the current WebMCP capability surface.

The suite is intentionally split by execution layer. Do not treat every `.scenario.md` as a browser-only UI test.

## Common Preflight

Runtime scenarios use Chrome DevTools MCP against the IDE dev server:

```text
http://localhost:8080/?workspaceDir=<absolute workspace path>
```

The page is ready when Chrome DevTools MCP evaluation confirms that the IDE shell is ready and at least one stable workbench signal is visible:

```js
const text = document.body.innerText || '';
const shellReady =
  document.readyState === 'complete' &&
  !!document.querySelector('#main') &&
  !document.querySelector('.loading_indicator');
const workbenchVisible =
  text.includes('EXPLORER') ||
  text.includes('Agentic') ||
  text.includes('editor.js') ||
  !!document.querySelector('.monaco-editor');
shellReady && workbenchVisible;
```

`EXPLORER` remains a useful Explorer-specific signal, but it is not the only valid readiness marker for Agentic-first layouts. Chrome DevTools MCP is used for browser startup, DOM readiness, UI interaction, and dialog observability. ACP tool execution uses the current OpenSumi MCP bridge when a scenario explicitly requires MCP transport. `navigator.modelContext` remains a supported WebMCP surface for browser runtime checks and is validated against MCP only where a scenario explicitly compares browser and MCP tool exposure.

## Scenario Layers

| Layer | Purpose | Execution expectation |
| --- | --- | --- |
| `runtime-ui` | Real IDE rendering, layout, dialogs, input, history, and visible recovery. | Run Common Preflight, then use Chrome DevTools MCP plus MCP calls only when the scenario requires them. |
| `mcp-contract` | WebMCP/MCP tool names, profile gating, catalog shape, bounded responses, and error contracts. | Use fresh MCP transport sessions; browser UI is needed only for observable dialog or surface parity checks. |
| `node-contract` | ACP service, thread, process, RPC, handler, storage, and debug-log behavior. | Run deterministic service/unit-contract fixtures; browser interaction is optional unless the scenario says otherwise. |
| `exploratory/manual` | Historical investigations, issue notes, and evidence reports. | Not part of the required `.scenario.md` suite; keep these as `.md`, `.json`, or image evidence files. |

Each `.scenario.md` must declare:

- `Layer`
- `Required profile`
- `Fixtures`
- `Workspace mutation`
- `Automation status`

Node/service scenarios are contract specs. They do not need to prove behavior by clicking through the browser unless the scenario explicitly includes a runtime UI assertion.

## Profile Matrix

| Profile | Expected coverage | Result rule |
| --- | --- | --- |
| `default` | Common Preflight, default ACP Chat smoke, default safe state tools, Agentic startup, fallback, and read-only layout checks. | Default-profile scenarios should PASS or FAIL. Do not mark interactive/full-only work as PARTIAL in a default run; skip scheduling it or mark it BLOCKED with the missing profile. |
| `interactive` | Default coverage plus profile-granted read/UI tools such as `acp_chat_list_sessions`, `acp_chat_get_available_commands`, `acp_chat_prepare_session_digest`, and IDE read groups. | Interactive scenarios should PASS/FAIL only when the profile is active and required fixtures exist. |
| `full` | Interactive coverage plus profile-granted write/debug tools such as `acp_chat_set_session_mode`, `acp_chat_post_prepared_relay`, `acp_chat_read_session_messages`, and reversible file/editor/terminal mutation checks. | Full-profile scenarios are BLOCKED, not PARTIAL, when the run lacks full profile, controlled sessions, or stable selectors. |

Use a profile-specific loopback URL when a local BDD run needs a non-default WebMCP profile. The query override is runtime-only, only applies on local loopback hosts, and does not write the user's saved `ai.native.webmcp.profile` preference:

```text
http://localhost:8080/?workspaceDir=<absolute workspace path>&webMcpProfile=interactive
http://localhost:8080/?workspaceDir=<absolute workspace path>&webMcpProfile=full
```

`PASS` means all required steps for the declared profile ran and met the assertions. `BLOCKED` means the scenario could not start because a declared prerequisite was unavailable. `FAIL` means the declared prerequisites were present but behavior violated the contract.

## Tool Names

The canonical WebMCP tool name is the only external capability identifier. Each tool is registered once in the browser `WebMcpGroupRegistry` with `tool.name`, and both supported surfaces expose that same name:

- Browser: `navigator.modelContext.getTools()` / `registerTool()`
- Node: the built-in MCP `opensumi-ide` server `tools/list` / `tools/call`

Examples:

| Group      | Canonical tool name               |
| ---------- | --------------------------------- |
| `file`     | `file_read`                       |
| `search`   | `search_text`                     |
| `acp_chat` | `acp_chat_get_session_state`      |
| `acp_chat` | `acp_chat_get_permission_state`   |
| `acp_chat` | `acp_chat_show_chat_view`         |
| `acp_chat` | `acp_chat_list_sessions`          |
| `acp_chat` | `acp_chat_get_available_commands` |
| `acp_chat` | `acp_chat_prepare_session_digest` |
| `acp_chat` | `acp_chat_post_prepared_relay`    |
| `acp_chat` | `acp_chat_read_session_messages`  |
| `acp_chat` | `acp_chat_set_session_mode`       |

There is no alias or fallback external name for capability tools. Legacy `_opensumi/{group}/{action}` identifiers and camelCase ACP Chat names must not appear in `navigator.modelContext`, MCP `tools/list`, catalog descriptions, or fallback broker calls. BDD may mention them only in explicit negative tests that prove they are rejected. Catalog helpers may temporarily accept old helper spellings for backward compatibility, but scenarios should call and assert the lower-snake canonical helper names.

Current MCP exposure:

- Default discovery: `opensumi_get_mcp_server_connection`
- Default profile: `acp_chat_get_session_state`, `acp_chat_get_permission_state`, `acp_chat_show_chat_view`
- Interactive/full profile: profile-granted read tools such as `acp_chat_list_sessions`, `acp_chat_get_available_commands`, and `acp_chat_prepare_session_digest`
- Full profile only: profile-granted write/debug tools such as `acp_chat_read_session_messages`, `acp_chat_set_session_mode`, and `acp_chat_post_prepared_relay`

The active WebMCP profile is the permission boundary for tool exposure. `opensumi_enable_capability_group` is retained as a catalog/discovery helper for agents and clients that want an explicit group acknowledgement, but BDD scenarios must not require it before invoking tools already allowed by the active profile. Profile-forbidden tools must remain absent from `tools/list` or fail with a structured boundary error even if a group helper has been called.

## MCP Helper

For browser-backed BDD runs, first discover the loopback MCP endpoint through the default browser WebMCP surface, then connect a standard MCP client to the returned Streamable HTTP URL:

```js
const connectionResult = await navigator.modelContext.executeTool('opensumi_get_mcp_server_connection', {});
const { url, redactedUrl } = connectionResult.result;
// Use `url` only for the MCP client. Use `redactedUrl` in evidence/logs.
const transport = new StreamableHTTPClientTransport(new URL(url));
await mcp.connect(transport);
```

Use the MCP client connected to the IDE's `opensumi-ide` server. Scenario steps refer to this shape:

```js
await mcp.callTool({ name: 'opensumi_discover_capabilities', arguments: { task: 'acp chat state' } });
await mcp.callTool({ name: 'acp_chat_get_session_state', arguments: {} });
```

Calling `opensumi_enable_capability_group` is optional for profile-granted tools and should be treated as a catalog helper, not a permission grant. If the client cannot call a profile-exposed capability tool directly, call through the fallback broker:

```js
await mcp.callTool({
  name: 'opensumi_invoke_capability_tool',
  arguments: {
    tool: 'acp_chat_list_sessions',
    arguments: {},
  },
});
```

The fallback broker must also tolerate common accidental nesting from agents and normalize it to the target tool's real arguments:

```js
await mcp.callTool({
  name: 'opensumi_invoke_capability_tool',
  arguments: {
    tool: 'acp_chat_list_sessions',
    arguments: {
      arguments: {},
    },
  },
});

await mcp.callTool({
  name: 'opensumi_invoke_capability_tool',
  arguments: {
    arguments: {
      tool: 'acp_chat_list_sessions',
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
- Runtime permission dismissal must use Chrome DevTools MCP to click a visible Reject or close control. If no stable selector exists, mark the scenario BLOCKED with `missing stable permission dialog selector`.
- Session-mode scenarios must verify that a successful mode switch is observable through session state. A response from `acp_chat_set_session_mode` alone is not enough.
- ACP Chat state/list responses may expose bounded, user-visible session title metadata such as `title` or `sourceTitle`, even when that title is derived from the first prompt. Do not treat those title fields as prompt-content leakage.
- ACP Chat scenarios must not assert full prompt/message bodies, assistant response text, tool-call arguments/results, raw ACP payloads, file contents, secrets, or permission content in `acp_chat_get_session_state`, `acp_chat_list_sessions`, or permission state responses.
- File/editor/terminal BDD belongs to those capability groups, not to ACP Chat.

## Current Scenarios

| Scenario | Layer | Required profile | Focus |
| --- | --- | --- | --- |
| `bdd-runtime-preflight.scenario.md` | `runtime-ui` | `default` | Browser readiness, ModelContext/MCP bridge availability, and blocked-run diagnostics. |
| `acp-chat.scenario.md` | `runtime-ui` | `default` | Default ACP Chat smoke and safe state observability. |
| `acp-chat-agentic-startup.scenario.md` | `runtime-ui` | `default` | Agentic startup, default layout, safe tool surface, and metadata-only state. |
| `acp-chat-agentic-fallback.scenario.md` | `runtime-ui` | `default` | Usable Agentic chat surface when ACP backend readiness fails. |
| `acp-layout-switch.scenario.md` | `runtime-ui` | `default` | Agentic/Classic switching, Explorer interop, resize bounds, and read-only state checks. |
| `acp-chat-agentic-input-send.scenario.md` | `runtime-ui` | `interactive` | Draft input, first send, commands, mentions, attachments, scroll, and recovery. |
| `acp-chat-agentic-stream-rendering.scenario.md` | `runtime-ui` | `interactive` | Deterministic ACP Agent stream rendering for content, reasoning, plan, tool calls, session state, completion, and recovery. |
| `acp-chat-agentic-cancel-stop.scenario.md` | `runtime-ui` | `interactive` | Long-stream stop/cancel behavior, input recovery, and follow-up send. |
| `acp-chat-agentic-rich-history-restore.scenario.md` | `runtime-ui` | `interactive` | Complex content, reasoning, plan, and tool-call history restore across switching and reload. |
| `acp-chat-agentic-permission-during-send.scenario.md` | `runtime-ui` | `full` | Permission dialog, badge, dismissal, and recovery during an active Agentic send. |
| `acp-chat-agentic-session-isolation.scenario.md` | `runtime-ui` | `interactive` | Concurrent session status, stream updates, and history selection isolation. |
| `acp-chat-agentic-config-controls.scenario.md` | `runtime-ui` | `full` | Mode, model, and config option controls, send-time gating, and safe state-summary checks. |
| `acp-chat-agentic-context-attachments.scenario.md` | `runtime-ui` | `interactive` | File, folder, code, and rule context chips, attachment cleanup, and metadata safety. |
| `acp-chat-agentic-command-surface.scenario.md` | `runtime-ui` | `interactive` | Slash command discovery, selection, cancellation, send, and metadata parity. |
| `acp-chat-agentic-reload-during-stream.scenario.md` | `runtime-ui` | `interactive` | Page reload while streaming and recovery to a usable Agentic chat state. |
| `acp-chat-agentic-error-taxonomy.scenario.md` | `runtime-ui` | `interactive` | Create, load, send, auth, disconnected, and config failure visibility and retry. |
| `acp-chat-agentic-layout-stress.scenario.md` | `runtime-ui` | `interactive` | Long content, tool results, scrolling, resizing, and layout round-trip stability. |
| `acp-chat-agentic-keyboard-a11y.scenario.md` | `runtime-ui` | `interactive` | Keyboard-only input, commands, history, dialogs, and tool-card interaction. |
| `acp-chat-agentic-debug-log-from-chat.scenario.md` | `runtime-ui` | `full` | Debug log viewer correlation and controls after a chat stream; redaction audit is blocked until product support exists. |
| `acp-chat-agentic-theme-persistence.scenario.md` | `runtime-ui` | `default` | Theme, Agentic layout preference, geometry, and visual usability persistence. |
| `acp-chat-agentic-history.scenario.md` | `runtime-ui` | `interactive` | New Chat, persisted history, session switching, and permission badges. |
| `acp-chat-agentic-layout-interop.scenario.md` | `runtime-ui` | `interactive` | Explorer/editor interop, resize, reload, and Agentic/Classic round trip. |
| `available-commands.scenario.md` | `mcp-contract` | `interactive/full` | Command metadata through profile-granted `acp_chat`. |
| `webmcp-capability-surface.scenario.md` | `mcp-contract` | `interactive/full` | Browser and MCP surfaces expose the same canonical tool names. |
| `acp-mcp-bridge.scenario.md` | `mcp-contract` | `default/interactive/full` | Built-in MCP bridge startup, injection, catalog, profiles, and profile-gated exposure. |
| `session-mode.scenario.md` | `mcp-contract` | `full` | Full-profile mode switching return contract plus metadata-only state reads. |
| `session-relay.scenario.md` | `mcp-contract` | `full` | Cross-session digest relay, permission gate, and bounded debug reads. |
| `permission-dialog.scenario.md` | `runtime-ui` | `full` | Permission state and dialog observability without ACP decision tools. |
| `error-handling.scenario.md` | `mcp-contract` | `full` | Capability boundaries, invalid inputs, and redacted structured errors. |
| `webmcp-ide-capability-groups.scenario.md` | `mcp-contract` | `full` | Workspace, search, diagnostics, file, terminal, and editor groups. |
| `terminal-file-tree-refresh.scenario.md` | `runtime-ui` | `full` | Terminal-created and terminal-deleted files refresh Explorer automatically. |
| `acp-agent-session-lifecycle.scenario.md` | `node-contract` | `default` | Node-side session creation, loading, streaming, cancellation, disposal, and pool cleanup. |
| `acp-session-advanced-operations.scenario.md` | `node-contract` | `default` | Config option, fork, resume, close, model selection, and available-mode operations. |
| `acp-thread-pool-lru.scenario.md` | `node-contract` | `default` | Thread-pool LRU recycling, evicted-session reload, race handling, and failure diagnostics. |
| `acp-agent-protocol-client.scenario.md` | `node-contract` | `default` | ACP protocol handshake, status machine, notification filtering, and entry conversion. |
| `acp-permission-routing.scenario.md` | `node-contract` | `full` | Node permission routing and browser permission bridge lifecycle. |
| `acp-process-config.scenario.md` | `node-contract` | `default` | Browser config merge and node spawn config resolution. |
| `acp-client-handlers.scenario.md` | `node-contract` | `default` | ACP client file and terminal handlers exposed to the agent process. |
| `acp-chat-session-storage.scenario.md` | `node-contract` | `default` | Browser chat session provider, activation, fallback, command propagation, and permission cleanup. |
| `acp-debug-log.scenario.md` | `runtime-ui` | `full` | Protocol trace store, entry bounds, raw viewer controls, and blocked redaction audit. |
| `acp-error-and-recovery.scenario.md` | `node-contract` | `full` | Structured failures and recovery across node, MCP, and browser UI boundaries. |
| `acp-rpc-bridge-and-status.scenario.md` | `node-contract` | `default` | Browser/node WebMCP RPC definitions, execution, and thread status synchronization. |

## Evidence and Reports

- Keep runtime screenshots, JSON captures, and dated reports in `test/bdd` or a dated evidence subdirectory.
- Evidence files are not required scenarios and should not be listed in Current Scenarios.
- Historical reports may use older scenario names. New runs should reference the split Agentic scenario files.

## Deleted or Split Scenarios

The following scenarios were removed because they target capabilities that are no longer part of the ACP Chat runtime contract:

- `message-flow.scenario.md`: required `acp_sendMessage`.
- `cancel-request.scenario.md`: required `acp_cancelRequest`.
- `session-lifecycle.scenario.md`: required create/switch/clear session tools.
- `file-operations.scenario.md`: belongs to the file capability group, not ACP.
- `chat-view.scenario.md`: covered by `acp_chat_show_chat_view`.
- `regression-core.scenario.md`: mixed unrelated groups and old direct tools.
- `background-permission-notification.scenario.md`: required old permission tools.
- `acp-agent-path-config.scenario.md`: not observable through ACP Chat WebMCP.

`acp-chat-agentic-layout.scenario.md` was split into focused Agentic startup, input/send, history, layout interop, and fallback scenarios. The non-scenario index is `acp-chat-agentic-layout.md`.
