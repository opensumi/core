# Scenario: Agent Session Archive and Restore

**Trigger:** `packages/ai-native/src/browser/acp/components/AgenticSessionList.tsx`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, or `packages/ai-native/src/browser/chat/acp-session-provider.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic `history` fixture with multiple Agent-owned Sessions in one available Project. **Workspace mutation:** None. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` for ordering, filtering, selection, local Archive/Unarchive, reload persistence, Agent ownership, metadata safety, and the Classic boundary.

## Given

- Agentic Layout displays multiple Sessions returned by the ACP Agent through `session/list`.
- The Archived Sessions area starts collapsed.
- Archive markers are local presentation metadata keyed by the Session route and do not mutate the Agent-owned Session.

## When

1. Create two deterministic Agent Sessions and confirm newest-first ordering.
2. Search and select Sessions without navigating or replacing the Agentic workbench.
3. Reveal the icon-only Archive action and archive a non-active Session.
4. Expand Archived Sessions and select the archived Session.
5. Reload the IDE and expand Archived Sessions again.
6. Unarchive the Session and inspect the Agent session catalog.
7. Switch to Classic layout and inspect its history popover.

## Then

- Archive removes the Session from its active Project rows and places it under the same Project in Archived Sessions.
- The Archived Sessions area starts collapsed before and after reload.
- Archived Sessions remain selectable through the normal `session/load` path.
- Reload preserves the local archive marker.
- Unarchive returns the Session to its active Project in Agent-provided ordering.
- Archive and Unarchive do not call ACP close or delete semantics: the Session remains present in the Agent-backed session catalog.
- Session metadata and BDD evidence contain no prompt, assistant, reasoning, tool-result, permission, or file-content sentinels.
- Agent-owned Session rows expose no legacy Durable Task status, attention, or unread controls.
- Classic layout retains its ACP history popover behavior.

## Pass / Blocked Judgment

- **PASS** - Archive/Unarchive, reload persistence, selection, Agent ownership, metadata safety, ordering, and Classic boundaries satisfy every assertion.
- **BLOCKED** - the deterministic history fixture, stable archive selectors, local persistence, or interactive profile is unavailable.
- **FAIL** - archiving closes or deletes the Agent Session, reload loses the marker, selection navigates the workspace, metadata leaks content, or unarchive restores the row to the wrong Project.

## Codegen Plan

- Keep `acp-chat-agentic-history.test.ts` as the hardened browser spec and reuse its deterministic history setup; do not add a second overlapping fixture workflow.
