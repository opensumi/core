# Scenario: WebMCP IDE Capability Groups - Workspace, Search, Diagnostics, File, Terminal, Editor

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/*.webmcp-group.ts`, `packages/ai-native/src/browser/acp/webmcp-group-registry.ts`, or `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- Use a fresh MCP client session so enabled groups do not leak from another scenario.
- The workspace contains `package.json`.
- The IDE can open an editor for `package.json`.
- Shell or terminal mutation steps run only in a full profile, or are skipped explicitly as profile-gated.

## When

### Part A - Catalog

1. `mcp`: `opensumi_discoverCapabilities({ task: "inspect IDE context", includeDisabled: true })`.
2. For each group, call `opensumi_describeCapabilityGroup({ group, includeSchemas: true })`:
   - `workspace`
   - `search`
   - `diagnostics`
   - `file`
   - `terminal`
   - `editor`
3. For each canonical tool name, call `opensumi_describeTool({ tool })`.
4. For representative legacy names such as `_opensumi/file/read` and `_opensumi/editor/getActive`, call `opensumi_describeTool`.

### Part B - Workspace And Search

5. Enable the `workspace` group and call:
   - `workspace_getInfo({})`
   - `workspace_listOpenFiles({})`
   - `workspace_listRecentWorkspaces({})`
6. Enable the `search` group and call:
   - `search_files({ query: "package" })`
   - `search_text({ query: "name", includePattern: "package.json" })`
   - `search_symbols({ query: "Acp" })`

### Part C - Diagnostics And File

7. Enable the `diagnostics` group and call:
   - `diagnostics_list({})`
   - `diagnostics_getStats({})`
8. If diagnostics exist, call `diagnostics_open` for one diagnostic.
9. Enable the `file` group and call:
   - `file_getWorkspaceRoot({})`
   - `file_exists({ path: "package.json" })`
   - `file_stat({ path: "package.json" })`
   - `file_read({ path: "package.json", maxBytes: 4096 })`
   - `file_list({ path: ".", limit: 50 })`
10. In full profile only, call reversible file mutation tools under a temporary workspace path:
    - `file_create({ path: ".tmp/acp-bdd/source.txt", content: "hello" })`
    - `file_write({ path: ".tmp/acp-bdd/source.txt", content: "updated" })`
    - `file_copy({ sourcePath: ".tmp/acp-bdd/source.txt", targetPath: ".tmp/acp-bdd/copy.txt" })`
    - `file_move({ sourcePath: ".tmp/acp-bdd/copy.txt", targetPath: ".tmp/acp-bdd/moved.txt" })`
    - `file_delete({ path: ".tmp/acp-bdd/source.txt" })`
    - `file_delete({ path: ".tmp/acp-bdd/moved.txt" })`

### Part D - Editor

11. Open `package.json` in the IDE.
12. Enable the `editor` group and call:
    - `editor_open({ path: "package.json" })`
    - `editor_getActive({})`
    - `editor_listOpenFiles({})`
    - `editor_getSelection({})`
    - `editor_readBuffer({})`
    - `editor_readRangeFromBuffer({ startLine: 1, endLine: 20 })`
    - `editor_listDirtyFiles({})`
    - `editor_getDirtyDiff({})`
13. In full profile only, call safe editor write/UI tools with reversible input:
    - `editor_setSelection`
    - `editor_format`
    - `editor_fold`
    - `editor_unfold`
    - `editor_save`
14. Close the editor opened by this scenario with `editor_close`.

### Part E - Terminal

15. Enable the `terminal` group and call read/UI tools:
    - `terminal_list({})`
    - `terminal_getActive({})`
    - `terminal_getOS({})`
    - `terminal_getProfiles({})`
    - `terminal_showPanel({})`
16. In full profile only, create a terminal and call:
    - `terminal_create({})`
    - `terminal_show({ terminalId })`
    - `terminal_executeCommand({ terminalId, command: "pwd" })`
    - `terminal_readOutput({ terminalId })`
    - `terminal_tail({ terminalId, lines: 20 })`
    - `terminal_getProcessInfo({ terminalId })`
    - `terminal_getProcessId({ terminalId })`
    - `terminal_waitForPattern({ terminalId, pattern: "." })`
    - `terminal_sendText({ terminalId, text: "" })`
    - `terminal_sendControl({ terminalId, control: "c" })`
    - `terminal_resize({ terminalId, cols: 80, rows: 24 })`
    - `terminal_runCommand({ command: "pwd" })`
    - `terminal_dispose({ terminalId })`

## Then

- Discovery lists all six IDE groups with canonical underscore tool names only.
- Each described group returns schemas for its tools without exposing workspace file contents or editor buffer contents in the catalog response.
- Legacy `_opensumi/...` names fail with `TOOL_NOT_FOUND` or equivalent.
- Before a non-default group is enabled, direct calls to that group's tools fail with `CAPABILITY_NOT_ENABLED` or are absent from `tools/list`.
- After enabling each group, read/UI tools for that group are callable in the current MCP session.
- Enabled groups remain scoped to the current MCP transport session.
- Workspace responses contain metadata such as roots and open files, not file contents.
- Search responses are bounded and include paths/ranges/snippets only within configured limits.
- Diagnostics responses are bounded and include severity, path, range, and message metadata.
- File read/list/stat/exists operations are workspace-scoped, bounded, and reject path traversal outside the workspace.
- File mutation operations are unavailable outside full profile and, when run, are limited to the temporary workspace path created by this scenario.
- Editor read operations return active-editor metadata or bounded buffer/range content only for open editor resources.
- Editor write/UI operations are unavailable outside full profile.
- Terminal shell/mutation operations are unavailable outside full profile.
- Terminal operations are bounded, require a valid terminal id when applicable, and clean up created terminals.

## Pass / Fail Judgment

- **PASS** - every registered IDE WebMCP capability group is discoverable, profile-gated, session-scoped, and its representative tools execute with bounded, canonical responses.
- **PARTIAL** - catalog and read/UI checks pass, but full-profile editor or terminal mutation checks are skipped because the environment is not full profile.
- **FAIL** - a registered group is missing from discovery, legacy aliases work, enablement leaks across MCP sessions, profile-gated tools are callable too early, or file/editor/terminal responses are unbounded or workspace-unsafe.
