# Scenario: ACP Chat Session Storage - Provider, Activation, Reload Reattachment, Fallback, Cleanup

**Trigger:** `packages/ai-native/src/browser/chat/acp-session-provider.ts`, `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Mock ACP chat provider, permission bridge, deterministic session models, browser `sessionStorage`, and an attachment stream that emits snapshot and live updates. **Workspace mutation:** None. **Automation status:** Automated service contract spec; browser runtime checks are covered by the split Agentic scenarios.

**Acceptance coverage:** Storage and bootstrap completion for `E-08` from `test/bdd/feat-0710-acceptance.md`; reload continuity also supports `E-01` and `E-02`.

## Given

- The browser runs with `supportsAgentMode=true`.
- The ACP session provider can create, list, load, and save sessions.
- The permission bridge is available.
- A previously viewed Task Conversation can remain active in the node/container while browser services are recreated.

## When

### Part A - Load Session List

1. Start `AcpChatManagerService`.
2. Provider returns more than 20 sessions.
3. Some returned sessions are already active in memory.
4. Provider returns sessions with raw ids and browser-prefixed `acp:` ids that refer to the same underlying session.

### Part B - Bootstrap And Lazy First Send

5. Initialize ACP Chat with a provider that can create one bootstrap Session and expose footer metadata.
6. Before user content is accepted, list visible history and start another New Task/New Chat draft.
7. Send the first valid prompt and record create calls, active Session id, visible history, and user-row count.
8. After the bootstrap has been used, start another empty draft and inspect history again.
9. Repeat with bootstrap creation failing, then send the first valid prompt through the lazy creation path.

### Part C - Activate Existing Session

10. Activate a session already loaded with history.
11. Activate a session not loaded in memory.
12. Activate a missing or failing ordinary Classic/history session.
13. Activate a missing or failing registered Agentic Task Session while another Task is active.
14. Activate a session whose available commands changed since it was last loaded.

### Part D - Reload And Reattach Last Viewed Task Conversation

15. Activate an ACP Task Conversation and remember it as the browser reload target.
16. Keep a different pending Project/Task launch target, then recreate the browser chat services as if the page reloaded.
17. Initialize storage and restore the remembered active Task Conversation by its existing session id.
18. Emit an attachment snapshot containing user-visible messages, assistant output, reasoning, tool calls/status, session state, and `working` thread status.
19. Emit output generated while disconnected plus later live output.
20. Repeat with `completed`, `failed`, and `auth_required` snapshots produced while the browser was detached.

### Part E - Clear And Dispose

21. Clear the active session.
22. Dispose `AcpChatInternalService`.
23. Emit a provider/session change event after disposal.

### Part F - Local Fallback

24. Provider setup fails or no ACP provider can handle mode `acp`.
25. `fallbackToLocal()` is called.

## Then

- Session list loading keeps at most the newest 20 sessions.
- Loading does not overwrite active in-memory sessions.
- Raw and prefixed ids are normalized for equality so the same ACP session does not appear twice.
- Sessions without history are retained only when their id starts with `acp:`.
- Initialization creates at most one bootstrap ACP Session, exposes its footer metadata, and hides it from visible history while it has no accepted user content.
- Starting another empty draft before first send does not create or persist another Session; the first valid send reuses the bootstrap and creates exactly one user row/history entry.
- After the bootstrap has been used, later empty drafts remain lazy and do not add empty history rows.
- Bootstrap failure does not block the first valid send: the send path creates the Session lazily and remains free of duplicate Sessions or user rows.
- Activating a loaded session avoids unnecessary provider load calls.
- Activating an unloaded session loads it through ACP, updates available commands, fires session model changes, and updates the permission bridge raw active session id.
- Changed available commands replace the previous command set instead of appending stale commands.
- Missing or failed ordinary Classic/history loads create a new draft/session and surface an informational message instead of leaving the UI without an active session.
- A failed registered Agentic Task activation preserves the previously active Task Conversation, selected row, unread marker, and composer state; it does not open an unbound replacement draft.
- The remembered active Task Conversation is stored separately from pending Project/Task activation or launch intent.
- Browser recreation restores the same Task Conversation and attaches by existing session id instead of opening a blank conversation, creating a new session, or resending the previous prompt.
- The authoritative attachment snapshot replaces stale browser state and restores messages, reasoning, tool calls/status, session state, and thread status, including output produced while disconnected.
- Later attachment updates continue to mutate the restored request without duplicating its user row or creating a phantom session.
- Detached `completed` and `failed` results restore their authoritative final state; `auth_required` remains incomplete and resumable for later output.
- Clearing the active session clears permission dialogs for the raw active session id before creating or selecting the replacement session.
- Dispose clears the permission bridge active session.
- Provider/session events after disposal do not mutate the disposed service or re-register listeners.
- Local fallback clears ACP sessions, switches to the local provider, and reloads the session list.

## Pass / Fail Judgment

- **PASS** - ACP chat storage preserves session bounds, active-session observability, reload reattachment, snapshot/live-update continuity, command propagation, and permission cleanup.
- **FAIL** - reload opens a blank or duplicate conversation, resends a prompt, loses detached output, old sessions exceed the cap, active session ids drift between `acp:<id>` and raw ids, or permission dialogs survive session clearing.
