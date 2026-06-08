# Scenario: WebMCP IDE Capability Groups - Workspace, Search, Diagnostics, File, Terminal, Editor

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/*.webmcp-group.ts`, `packages/ai-native/src/browser/acp/webmcp-group-registry.ts`, or `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`

**Layer:** `mcp-contract` **Required profile:** `full` **Fixtures:** Fresh MCP session, workspace containing a small `package.json`, and a temporary workspace path for reversible mutation checks. **Workspace mutation:** Temporary files under `.tmp/acp-bdd` only. **Automation status:** Automated MCP contract spec; default/interactive runs should skip this full-profile scenario.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- Use a fresh MCP client session so transport-local catalog helper state does not leak from another scenario.
- The workspace contains a small `package.json`.
- The IDE can open an editor for `package.json`.
- Shell or terminal mutation steps run only in a full profile, or are skipped explicitly as profile-gated.

## When

### Part A - Catalog

1. `mcp`: `opensumi_discover_capabilities({ task: "inspect IDE context", includeDisabled: true })`.
2. For each group, call `opensumi_describe_capability_group({ group, includeSchemas: true })`:
   - `workspace`
   - `search`
   - `diagnostics`
   - `file`
   - `terminal`
   - `editor`
3. For each canonical tool name, call `opensumi_describe_tool({ tool })`.
4. For representative legacy names such as `_opensumi/file/read` and `_opensumi/editor/getActive`, call `opensumi_describe_tool`.

### Part B - Workspace And Search

5. Call `workspace` group tools exposed by the active profile:
   - `workspace_get_info({})`
   - `workspace_list_open_files({})`
   - `workspace_list_recent_workspaces({})`
   - record `WORKSPACE_ROOT` from `workspace_get_info.result.workspaceDir` or the first root path
6. Call `search` group tools exposed by the active profile:
   - `search_files({ query: "package" })`
   - `search_text({ query: "name", include: ["package.json"], maxResults: 20 })`
   - `search_symbols({ query: "Acp" })`

### Part C - Diagnostics And File

7. Call `diagnostics` group tools exposed by the active profile:
   - `diagnostics_list({})`
   - `diagnostics_get_stats({})`
8. If diagnostics exist, call `diagnostics_open` for one diagnostic.
9. Call `file` group tools exposed by the active profile:
   - `file_get_workspace_root({})`
   - `file_exists({ path: "package.json" })`
   - `file_stat({ path: "package.json" })`
   - `file_read({ path: "package.json" })`
   - `file_list({ path: "." })`
10. In full profile only, call reversible file mutation tools under a temporary workspace path:
    - `file_create({ path: ".tmp/acp-bdd/source.txt", content: "hello" })`
    - `file_write({ path: ".tmp/acp-bdd/source.txt", content: "updated" })`
    - `file_create({ path: ".tmp/acp-bdd/editor.ts", content: "function acpBdd() {\n return 1;\n}\n" })`
    - `file_copy({ sourcePath: ".tmp/acp-bdd/source.txt", targetPath: ".tmp/acp-bdd/copy.txt" })`
    - `file_move({ sourcePath: ".tmp/acp-bdd/copy.txt", targetPath: ".tmp/acp-bdd/moved.txt" })`
    - `file_delete({ path: ".tmp/acp-bdd/source.txt" })`
    - `file_delete({ path: ".tmp/acp-bdd/moved.txt" })`

### Part D - Editor

11. Derive absolute editor paths from `WORKSPACE_ROOT`:
    - `PACKAGE_ABS = WORKSPACE_ROOT + "/package.json"`
    - `TEMP_EDITOR_ABS = WORKSPACE_ROOT + "/.tmp/acp-bdd/editor.ts"`
12. Call `editor` group tools exposed by the active profile:
    - `editor_open({ path: PACKAGE_ABS })`
    - `editor_get_active({})`
    - `editor_list_open_files({})`
    - `editor_get_selection({})`
    - `editor_read_buffer({})`
    - `editor_read_range_from_buffer({ path: PACKAGE_ABS, startLine: 1, endLine: 20 })`
    - `editor_list_dirty_files({})`
    - `editor_get_dirty_diff({ path: PACKAGE_ABS })`
13. In full profile only, call safe editor write/UI tools with reversible input:
    - `editor_set_selection({ path: TEMP_EDITOR_ABS, startLine: 1 })`
    - `editor_format({ path: TEMP_EDITOR_ABS })`
    - `editor_fold({ path: TEMP_EDITOR_ABS, startLine: 1 })`
    - `editor_unfold({ path: TEMP_EDITOR_ABS, startLine: 1 })`
    - `editor_save({ path: TEMP_EDITOR_ABS })`
14. Close editors and clean up the remaining temporary editor file:
    - `editor_close({ path: PACKAGE_ABS })`
    - `editor_close({ path: TEMP_EDITOR_ABS })`
    - `file_delete({ path: ".tmp/acp-bdd/editor.ts" })`

### Part E - Terminal

15. Call `terminal` group read/UI tools exposed by the active profile:
    - `terminal_list({})`
    - `terminal_get_active({})`
    - `terminal_get_os({})`
    - `terminal_get_profiles({})`
    - `terminal_show_panel({})`
16. In full profile only, create a terminal and call:
    - `terminal_create({})` and record `TERMINAL_ID = result.id`
    - `terminal_show({ id: TERMINAL_ID })`
    - `terminal_execute_command({ id: TERMINAL_ID, command: "pwd\n" })`
    - `terminal_read_output({ id: TERMINAL_ID, maxLines: 120 })`
    - `terminal_tail({ id: TERMINAL_ID, maxLines: 20 })`
    - `terminal_get_process_info({ id: TERMINAL_ID })`
    - `terminal_get_process_id({ id: TERMINAL_ID })`
    - `terminal_wait_for_pattern({ id: TERMINAL_ID, pattern: "." })`
    - `terminal_send_text({ id: TERMINAL_ID, text: "" })`
    - `terminal_send_control({ id: TERMINAL_ID, key: "ctrl-c" })`
    - `terminal_resize({ id: TERMINAL_ID, cols: 80, rows: 24 })`
    - `terminal_run_command({ id: TERMINAL_ID, command: "pwd" })`
    - `terminal_dispose({ id: TERMINAL_ID })`

## Then

- Discovery lists all six IDE groups with canonical underscore tool names only.
- Each described group returns schemas for its tools without exposing workspace file contents or editor buffer contents in the catalog response.
- Legacy `_opensumi/...` names fail with `TOOL_NOT_FOUND` or equivalent.
- Profile-granted tools for default-loaded groups are callable in the current MCP session without requiring `opensumi_enable_capability_group`.
- Profile-forbidden tools are absent from `tools/list` or fail with a structured boundary error, and the optional catalog helper cannot override the active profile.
- Transport-local catalog helper state does not change the profile boundary for another MCP transport session.
- Workspace responses contain metadata such as roots and open files, not file contents.
- Search responses are bounded and include paths/ranges/snippets only within configured limits.
- Diagnostics responses are bounded and include severity, path, range, and message metadata.
- File read/list/stat/exists operations are workspace-scoped and reject path traversal outside the workspace. `file_read` and `file_list` currently do not accept `maxBytes` or `limit`, so this scenario uses a small fixture file and small fixture workspace.
- File mutation operations are unavailable outside full profile and, when run, are limited to the temporary workspace path created by this scenario.
- Editor read operations return active-editor metadata or bounded buffer/range content only for open editor resources.
- Editor write/UI operations are unavailable outside full profile.
- Terminal shell/mutation operations are unavailable outside full profile.
- Terminal operations are bounded, require a valid terminal id when applicable, and clean up created terminals.

## Pass / Fail Judgment

- **PASS** - every registered IDE WebMCP capability group is discoverable, profile-gated, and its representative tools execute with bounded, canonical responses.
- **BLOCKED** - the scenario is scheduled without the required full profile, so reversible file/editor/terminal mutation checks cannot be exercised.
- **FAIL** - a registered group is missing from discovery, legacy aliases work, profile-granted tools require a catalog helper, profile-forbidden tools are callable, or file/editor/terminal responses are unbounded or workspace-unsafe.
