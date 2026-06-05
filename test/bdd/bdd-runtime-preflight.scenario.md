# Scenario: BDD Runtime Preflight - Browser, ModelContext, MCP Bridge

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-model-context-adapter.ts`, `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`, or `test/bdd/README.md`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** IDE dev server and, when ACP bridge checks run, an agent session with HTTP MCP support. **Workspace mutation:** None. **Automation status:** Automated preflight; downstream runtime scenarios are blocked until this passes.

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
2. Wait until:
   ```js
   document.readyState === 'complete' &&
     !!document.querySelector('#main') &&
     !document.querySelector('.loading_indicator') &&
     document.body.innerText.includes('EXPLORER');
   ```
3. Record visible fatal error text and browser console errors.

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

### Part C - MCP Bridge Surface

7. Create or load an ACP session with HTTP MCP supported.
8. Connect an MCP client to the injected `opensumi-ide` server.
9. Call `tools/list`.
10. Call `opensumi_discover_capabilities({ task: "preflight", includeDisabled: true })`.
11. Enable `acp_chat` and call `acp_chat_get_session_state({})` directly or through `opensumi_invoke_capability_tool`.

### Part D - Failure Diagnostics

12. If any preflight step fails, collect:
    - IDE URL
    - Chrome DevTools MCP target URL
    - document readiness result
    - whether `#main` exists
    - whether `navigator.modelContext` exists
    - MCP `tools/list` names, if available
    - relevant console errors without secrets

## Then

- Browser readiness must pass before any BDD scenario runs browser or DOM assertions.
- A BDD runner must have at least one supported execution surface:
  - browser `navigator.modelContext`, or
  - connected MCP `opensumi-ide` server with catalog tools.
- Browser and MCP surfaces expose canonical underscore tool names only.
- Runtime diagnostics must redact MCP token paths and secret-like query values.
- If no supported execution surface is available, downstream scenarios are marked **BLOCKED** instead of failed.
- Blocked output points to the missing surface explicitly, for example `navigator.modelContext missing` or `opensumi-ide MCP tools/list unavailable`.

## Pass / Fail Judgment

- **PASS** - the IDE is ready and at least one supported tool execution surface can list and invoke canonical tools.
- **BLOCKED** - the IDE renders but neither browser ModelContext nor the MCP bridge execution surface is available.
- **FAIL** - the IDE does not render, readiness never completes, or diagnostics leak the full MCP bridge token or other secrets.
