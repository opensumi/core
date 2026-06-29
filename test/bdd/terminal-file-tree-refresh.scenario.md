# Scenario: Terminal File Tree Refresh - Terminal-Created File Appears In Explorer

**Trigger:** `packages/file-service/src/node/hosted/recursive/file-service-watcher.ts`, `packages/file-service/src/node/watcher-process-manager.ts`, `packages/file-tree-next/src/browser/file-tree.service.ts`, `packages/terminal-next`, or `packages/ai-native/src/browser/acp/webmcp-groups/terminal.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `full` **Fixtures:** IDE dev server opened with the default workspace, Explorer visible, full-profile file and terminal WebMCP tools exposed, and a POSIX-compatible terminal profile. **Workspace mutation:** One temporary root-level file named `terminal-file-tree-refresh-<RUN_ID>.txt`, deleted before the scenario ends. **Automation status:** Automated through Chrome DevTools MCP plus browser WebMCP/MCP calls; convert to Playwright once Explorer selectors and terminal profile setup are stable in CI.

## Given

- Common preflight in `test/bdd/README.md` passes with:
  ```text
  http://localhost:8080/?workspaceDir=<absolute workspace path>&webMcpProfile=full
  ```
- Explorer is visible and the file tree root is loaded.
- Browser `navigator.modelContext` is available, or the MCP `opensumi-ide` server is connected.
- The active profile exposes full-profile terminal and file tools:
  - `file_get_workspace_root`
  - `file_exists`
  - `terminal_create`
  - `terminal_show`
  - `terminal_resize`
  - `terminal_get_process_info`
  - `terminal_run_command`
  - `terminal_read_output`
  - `terminal_wait_for_pattern`
- The scenario chooses a unique `RUN_ID` and sets:
  ```text
  REL_FILE = terminal-file-tree-refresh-<RUN_ID>.txt
  MARKER_CWD = TREE_CWD_<RUN_ID>
  MARKER_CREATE = TREE_CREATE_<RUN_ID>
  MARKER_DELETE = TREE_DELETE_<RUN_ID>
  ```
  Marker commands must emit the marker by splitting the static prefix and `RUN_ID` into separate shell words, so `terminal_wait_for_pattern` matches command output rather than the terminal's echoed command line.

## When

### Part A - Setup And Terminal CWD

1. `webmcp`: call `file_get_workspace_root({})` and record `WORKSPACE_ROOT`.
2. `webmcp`: call `file_exists({ path: REL_FILE })`.
3. If `REL_FILE` exists from a prior interrupted run, choose a new `RUN_ID` and repeat the `file_exists({ path: REL_FILE })` pre-check.
4. `chrome-devtools-mcp`: assert Explorer does not display `REL_FILE`.
5. `webmcp`: call `terminal_create({})` and record `TERMINAL_ID`.
6. `webmcp`: call `terminal_show({ id: TERMINAL_ID })`.
7. `webmcp`: call `terminal_resize({ id: TERMINAL_ID, cols: 200, rows: 24 })` so marker lines are not split by a narrow panel.
8. `webmcp`: poll `terminal_get_process_info({ id: TERMINAL_ID })` until `ready` is `true`, and record the reported `cwd`.
9. `webmcp`: call `terminal_run_command({ id: TERMINAL_ID, command: "pwd && printf 'TREE_CWD_' && printf '<RUN_ID>\\n'" })`.
10. `webmcp`: call `terminal_wait_for_pattern({ id: TERMINAL_ID, pattern: MARKER_CWD, timeoutMs: 10000 })`.
11. `webmcp`: call `terminal_read_output({ id: TERMINAL_ID, maxLines: 120 })` and record the `pwd` output.

### Part B - Create File From Terminal

12. `webmcp`: call:

```js
terminal_run_command({
  id: TERMINAL_ID,
  command: "printf 'created from terminal\\n' > '<REL_FILE>' && printf 'TREE_CREATE_' && printf '<RUN_ID>\\n'",
});
```

13. `webmcp`: wait for `MARKER_CREATE` in terminal output.
14. `webmcp`: call `file_exists({ path: REL_FILE })`.
15. `chrome-devtools-mcp`: without invoking Explorer Refresh, reloading the page, or using a file WebMCP mutation tool for `REL_FILE`, wait up to `5000ms` for the Explorer file tree to display `REL_FILE`.

### Part C - Delete File From Terminal

16. `webmcp`: call:

```js
terminal_run_command({
  id: TERMINAL_ID,
  command: "rm -f '<REL_FILE>' && printf 'TREE_DELETE_' && printf '<RUN_ID>\\n'",
});
```

17. `webmcp`: wait for `MARKER_DELETE` in terminal output.
18. `webmcp`: call `file_exists({ path: REL_FILE })`.
19. `chrome-devtools-mcp`: without invoking Explorer Refresh or reloading the page, wait up to `5000ms` for the Explorer file tree to stop displaying `REL_FILE`.
20. `webmcp`: call `terminal_run_command({ id: TERMINAL_ID, command: "exit" })`.

## Then

- The terminal created by `terminal_create({})` is ready and starts in `WORKSPACE_ROOT`, or the scenario records a terminal default-CWD regression.
- After the create command completes, `file_exists({ path: REL_FILE })` returns `true`.
- The Explorer file tree displays `REL_FILE` automatically after the terminal-created file appears on disk.
- The Explorer assertion must pass without manual Refresh, page reload, `file_create`, `file_write`, or direct file-tree service calls.
- After the delete command completes, `file_exists({ path: REL_FILE })` returns `false`.
- The Explorer file tree removes `REL_FILE` automatically after the terminal-deleted file disappears from disk.
- Terminal output captures only bounded command output and marker text; evidence must not include secrets or full MCP token URLs.

## Pass / Fail Judgment

- **PASS** - the terminal default cwd is the workspace root, terminal-created and terminal-deleted files are reflected in Explorer automatically, and cleanup succeeds.
- **BLOCKED** - the run lacks full profile, terminal tools, file tools, Explorer DOM selectors, a POSIX-compatible terminal profile, or a loaded workspace root.
- **FAIL** - the terminal command succeeds and file-service existence checks reflect the disk state, but Explorer does not update until manual refresh or reload; the terminal starts outside the workspace root; or cleanup leaves the temporary file visible in Explorer.
