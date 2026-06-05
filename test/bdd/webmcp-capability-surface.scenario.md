# Scenario: WebMCP Capability Surface - Canonical Names on Browser and MCP

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-group-registry.ts`, `packages/ai-native/src/browser/acp/webmcp-model-context-adapter.ts`, or `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`

## Given

- Common preflight in `test/bdd/README.md` passes.
- `navigator.modelContext` exists. Native browser implementations and the OpenSumi polyfill are both acceptable.
- The MCP `opensumi-ide` server is connected.
- Use a fresh MCP client session for this scenario so enabled capability groups do not leak in from another scenario.

## When

1. `chrome-devtools-mcp-evaluate`: collect browser tools:
   ```js
   navigator.modelContext
     .getTools()
     .map((tool) => tool.name)
     .sort();
   ```
   -> record `BROWSER_TOOL_NAMES`.
2. `mcp`: `tools/list` -> record `MCP_TOOL_NAMES`.
3. `mcp`: `opensumi_discoverCapabilities({ task: "compare webmcp surfaces", includeDisabled: true })` -> record `CATALOG`.
4. `mcp`: `opensumi_describeTool({ tool: "file_read" })` -> record `FILE_READ_DESCRIPTION`.
5. `mcp`: `opensumi_describeTool({ tool: "_opensumi/file/read" })` -> record `LEGACY_FILE_READ_DESCRIPTION`.
6. If `file_read` is present in both surfaces, call the browser surface with a small existing file:
   ```js
   navigator.modelContext.executeTool('file_read', { path: 'package.json' });
   ```
   -> record `BROWSER_FILE_READ`.
7. If `file_read` is present in MCP `tools/list`, call the MCP surface:
   ```js
   file_read({ path: 'package.json' });
   ```
   -> record `MCP_FILE_READ`.

## Then

- Step 1 succeeds and every browser tool name is a canonical underscore name.
- Step 2 succeeds and every OpenSumi capability tool name is a canonical underscore name.
- Neither `BROWSER_TOOL_NAMES` nor `MCP_TOOL_NAMES` contains a name that starts with `_opensumi/`.
- `BROWSER_TOOL_NAMES` and the default non-catalog MCP capability tools contain the same default-loaded canonical WebMCP tool names, subject to the active profile.
- Step 3 catalog entries use canonical `tool.name` values only.
- Step 4 succeeds for `file_read`.
- Step 5 fails with `TOOL_NOT_FOUND` or an equivalent structured not-found response. It must not resolve `_opensumi/file/read` as an alias.
- If Steps 6 and 7 run, both calls execute the same capability and return the same success/failure class for the same input.

## Pass / Fail Judgment

- **PASS** - browser `navigator.modelContext` and the Node MCP server expose the same canonical WebMCP names, and legacy `_opensumi/...` identifiers are not accepted.
- **PARTIAL** - name and catalog checks pass, but file execution is skipped because `file_read` is not exposed by the active profile.
- **FAIL** - either surface exposes a legacy `_opensumi/...` name, accepts a legacy alias, or diverges from the shared registry naming contract.
