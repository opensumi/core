# Scenario: ACP Client Handlers - File System and Terminal Delegation

**Trigger:** `packages/ai-native/src/node/acp/handlers/file-system.handler.ts`, `packages/ai-native/src/node/acp/handlers/terminal.handler.ts`, or `packages/ai-native/src/node/acp/acp-thread.ts`

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

### Part B - File Writes

6. Agent calls `writeTextFile` for a new workspace-relative file path.
7. Agent calls `writeTextFile` for an existing file.
8. Agent calls `writeTextFile` for a nested path whose parent folder does not exist.
9. Agent calls `writeTextFile` with a path traversal outside the workspace.

### Part C - Terminal Lifecycle

10. Agent calls `createTerminal` with a short command and session id.
11. Agent calls `terminalOutput` with the owning session id.
12. Agent calls `waitForTerminalExit` before and after the command exits.
13. Agent calls `terminalOutput`, `waitForTerminalExit`, `killTerminal`, or `releaseTerminal` with a different session id.
14. Agent calls `releaseTerminal` twice for the same terminal.
15. Agent creates two terminals for a session and `releaseSessionTerminals(sessionId)` is called during session disposal.

## Then

- File reads resolve paths relative to the configured workspace.
- `line` and `limit` return the expected bounded slice.
- Missing files return `RESOURCE_NOT_FOUND` style errors.
- Workspace escape attempts return an invalid-path error and do not read or write outside the workspace.
- Oversized files fail before content is returned.
- File writes create parent folders when needed and update existing files through the file service.
- Terminal creation returns a `terminalId` owned by the raw ACP session id.
- Terminal output returns output text, truncation state, and exit status only for the owning session.
- Session mismatch returns an error for all terminal operations that target an existing terminal.
- `releaseTerminal` is idempotent for already released or missing terminals.
- `releaseSessionTerminals` releases only terminals owned by the target session.
- Handler errors thrown through `AcpThread` become agent-call errors instead of silent successes.

## Pass / Fail Judgment

- **PASS** - file and terminal client hooks are workspace/session scoped, bounded, and cleaned up with session disposal.
- **FAIL** - path traversal succeeds, terminal ownership is bypassed, output is unbounded, or released terminals remain attached to a disposed session.
