# Scenario: BDD Runtime Preflight - Browser Readiness and Execution Surface

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-model-context-adapter.ts`, `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`, or `test/bdd/README.md`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** IDE dev server and, when ACP bridge checks run, an agent session with HTTP MCP support. **Workspace mutation:** None. **Automation status:** Automated preflight; downstream runtime scenarios are blocked until browser readiness passes. Scenarios that explicitly require the `opensumi-ide` MCP bridge are blocked only when that bridge surface is unavailable.

## Given

- The IDE dev server is running.
- A workspace path is available.
- Chrome DevTools MCP can connect to a browser target.
- An MCP client can connect to the built-in `opensumi-ide` MCP server when the server is injected into an ACP session.

## When

### Part A - Browser Readiness

1. Open:
   ```text
   http://localhost:8080/?workspaceDir=<absolute workspace path>
   ```
2. Wait until the IDE shell is ready and at least one stable workbench signal is visible:
   ```js
   const text = document.body.innerText || '';
   const shellReady =
     document.readyState === 'complete' &&
     !!document.querySelector('#main') &&
     !document.querySelector('.loading_indicator');
   const workbenchVisible =
     text.includes('EXPLORER') ||
     text.includes('Agentic') ||
     text.includes('AI Assistant') ||
     text.includes('editor.js') ||
     !!document.querySelector('.monaco-editor');
   shellReady && workbenchVisible;
   ```
3. Record visible fatal error text, modal startup prompts, and browser console errors.

### Part B - Browser Tool Surface

4. Evaluate:
   ```js
   Boolean(navigator.modelContext);
   ```
5. If present, evaluate:
   ```js
   navigator.modelContext
     .getTools()
     .map((tool) => tool.name)
     .sort();
   ```
6. If absent, record whether a test-only fallback surface such as `navigator.modelContextTesting` exists.
7. If `navigator.modelContext.executeTool` exists, call the default-safe ACP Chat tools:
   ```js
   navigator.modelContext.executeTool('acp_chat_get_session_state', {});
   navigator.modelContext.executeTool('acp_chat_get_permission_state', {});
   navigator.modelContext.executeTool('acp_chat_show_chat_view', {});
   ```

### Part C - MCP Bridge Surface

8. If a downstream scenario requires MCP transport, call:
   ```js
   navigator.modelContext.executeTool('opensumi_get_mcp_server_connection', {});
   ```
   Use the returned `url` only for the MCP client and `redactedUrl` in evidence/logs. If the discovery tool is unavailable, create or load an ACP session with HTTP MCP supported and use the injected `opensumi-ide` server.
9. Connect an MCP client to the `opensumi-ide` Streamable HTTP server.
10. Call `tools/list`.
11. Call `opensumi_discover_capabilities({ task: "preflight", includeDisabled: true })`.
12. Enable `acp_chat` and call `acp_chat_get_session_state({})` directly or through `opensumi_invoke_capability_tool`.
13. If MCP transport is unavailable but browser `navigator.modelContext` can list and execute the required default tools, continue browser-only runtime scenarios and mark only MCP-dependent scenarios **BLOCKED**.

### Part D - Failure Diagnostics

14. If any preflight step fails, collect:
    - IDE URL
    - Chrome DevTools MCP target URL
    - document readiness result
    - whether `#main` exists
    - whether `navigator.modelContext` exists
    - browser `navigator.modelContext` tool names and default-safe call results, if available
    - MCP `tools/list` names, if available and required
    - relevant console errors without secrets

## Then

- Browser readiness must pass before any BDD scenario runs browser or DOM assertions.
- A BDD runner must have at least one supported execution surface:
  - browser `navigator.modelContext`, or
  - connected MCP `opensumi-ide` server with catalog tools.
- Browser and MCP surfaces expose canonical underscore tool names only when those surfaces are available.
- The literal `EXPLORER` text is a useful Explorer-specific signal, but it is not the only valid readiness marker for Agentic-first layouts; `AI Assistant` is valid when the Agentic workbench starts hidden.
- Extension host or worker-host console errors are recorded as diagnostics. They fail preflight only when they prevent shell readiness, block the scenario's required UI surface, or leak secrets.
- Runtime diagnostics must redact MCP token paths and secret-like query values.
- If no supported execution surface is available, downstream scenarios are marked **BLOCKED** instead of failed.
- If browser readiness and browser `navigator.modelContext` pass but MCP transport is unavailable, browser-only runtime scenarios may continue and MCP-dependent scenarios are marked **BLOCKED** with the missing MCP prerequisite.
- Blocked output points to the missing surface explicitly, for example `navigator.modelContext missing` or `opensumi-ide MCP tools/list unavailable`.

## Pass / Fail Judgment

- **PASS** - the IDE shell is ready, at least one stable workbench signal is visible, and at least one supported tool execution surface can list and invoke required canonical tools for the scheduled downstream scenario set.
- **BLOCKED** - the IDE renders but the execution surface required by the scheduled downstream scenario set is unavailable, for example MCP transport for MCP-dependent scenarios or browser `navigator.modelContext` for browser-only WebMCP checks.
- **FAIL** - the IDE does not render, browser readiness never completes, a fatal startup prompt blocks the required UI surface, required default-safe browser tool execution fails when browser runtime scenarios are scheduled, or diagnostics leak the full MCP bridge token or other secrets.
