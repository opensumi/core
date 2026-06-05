# Scenario: ACP Client Handlers - File System and Terminal Delegation

**Trigger:** `packages/ai-native/src/node/acp/handlers/file-system.handler.ts`, `packages/ai-native/src/node/acp/handlers/terminal.handler.ts`, or `packages/ai-native/src/node/acp/acp-thread.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Temporary file-system and terminal handler fixtures owned by one ACP session. **Workspace mutation:** Temporary fixture resources only. **Automation status:** Automated contract spec; runtime WebMCP file/terminal coverage lives in `webmcp-ide-capability-groups.scenario.md`.

## Given

- The ACP thread has initialized and created a session.
- `AcpFileSystemHandler` is configured with the workspace directory.
- `AcpTerminalHandler` is available.
- The agent can call ACP client methods:
  - `readTextFile`
  - `writeTextFile`
  - `createTerminal`
  - `terminalOutput`
  - `waitForTerminalExit`
  - `killTerminal`
  - `releaseTerminal`

## When

### Part A - File Reads

1. Agent calls `readTextFile` with a workspace-relative text file path.
2. Agent calls `readTextFile` with `line` and `limit`.
3. Agent calls `readTextFile` with a missing file.
4. Agent calls `readTextFile` with an absolute path outside the workspace.
5. Agent calls `readTextFile` for a file larger than `maxFileSize`.
6. Agent calls `readTextFile` with `../` traversal and URL-encoded traversal variants.

### Part B - File Writes

7. Agent calls `writeTextFile` for a new workspace-relative file path.
8. Agent calls `writeTextFile` for an existing file.
9. Agent calls `writeTextFile` for a nested path whose parent folder does not exist.
10. Agent calls `writeTextFile` with a path traversal outside the workspace.
11. Agent calls `writeTextFile` with binary-looking or very large text content.

### Part C - Terminal Lifecycle

12. Agent calls `createTerminal` with a short command and session id.
13. Agent calls `terminalOutput` with the owning session id.
14. Agent calls `terminalOutput` with a small limit and then a large limit.
15. Agent calls `waitForTerminalExit` before and after the command exits.
16. Agent calls `terminalOutput`, `waitForTerminalExit`, `killTerminal`, or `releaseTerminal` with a different session id.
17. Agent calls `releaseTerminal` twice for the same terminal.
18. Agent creates two terminals for a session and `releaseSessionTerminals(sessionId)` is called during session disposal.

## Then

- File reads resolve paths relative to the configured workspace.
- `line` and `limit` return the expected bounded slice.
- Missing files return `RESOURCE_NOT_FOUND` style errors.
- Workspace escape attempts return an invalid-path error and do not read or write outside the workspace.
- Oversized files fail before content is returned.
- File writes create parent folders when needed and update existing files through the file service.
- Large writes are either rejected with a structured error or written through the same file service path; they must not block the event loop with unbounded synchronous writes.
- Terminal creation returns a `terminalId` owned by the raw ACP session id.
- Terminal output returns output text, truncation state, and exit status only for the owning session.
- Terminal output respects requested bounds/caps and reports truncation when output is cut.
- Session mismatch returns an error for all terminal operations that target an existing terminal.
- `releaseTerminal` is idempotent for already released or missing terminals.
- `releaseSessionTerminals` releases only terminals owned by the target session.
- Handler errors thrown through `AcpThread` become agent-call errors instead of silent successes.

## Pass / Fail Judgment

- **PASS** - file and terminal client hooks are workspace/session scoped, bounded, and cleaned up with session disposal.
- **FAIL** - path traversal succeeds, terminal ownership is bypassed, output is unbounded, or released terminals remain attached to a disposed session.
