# Scenario: ACP Chat Session Storage - Provider, Activation, Fallback, Cleanup

**Trigger:** `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts` or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

## Given

- The browser runs with `supportsAgentMode=true`.
- The ACP session provider can create, list, load, and save sessions.
- The permission bridge is available.

## When

### Part A - Load Session List

1. Start `AcpChatManagerService`.
2. Provider returns more than 20 sessions.
3. Some returned sessions are already active in memory.

### Part B - Create Session

4. `AcpChatInternalService.createSessionModel()` is called.
5. Provider returns a new ACP session with `extension.availableCommands`.

### Part C - Activate Existing Session

6. Activate a session already loaded with history.
7. Activate a session not loaded in memory.
8. Activate a missing or failing session.

### Part D - Clear And Dispose

9. Clear the active session.
10. Dispose `AcpChatInternalService`.

### Part E - Local Fallback

11. Provider setup fails or no ACP provider can handle mode `acp`.
12. `fallbackToLocal()` is called.

## Then

- Session list loading keeps at most the newest 20 sessions.
- Loading does not overwrite active in-memory sessions.
- Sessions without history are retained only when their id starts with `acp:`.
- Creating a session stores the model, starts listening for changes, propagates available commands, fires session model change events, and sets the permission bridge active session to the raw id.
- Activating a loaded session avoids unnecessary provider load calls.
- Activating an unloaded session loads it through ACP, updates available commands, fires session model changes, and updates the permission bridge raw active session id.
- Missing or failed loads create a new session and surface an informational message instead of leaving the UI without an active session.
- Clearing the active session clears permission dialogs for the raw active session id before creating or selecting the replacement session.
- Dispose clears the permission bridge active session.
- Local fallback clears ACP sessions, switches to the local provider, and reloads the session list.

## Pass / Fail Judgment

- **PASS** - ACP chat storage preserves session bounds, active-session observability, command propagation, and permission cleanup.
- **FAIL** - old sessions exceed the cap, active session ids drift between `acp:<id>` and raw ids, or permission dialogs survive session clearing.
