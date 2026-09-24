# Scenario: Agentic Long-History Session Switching

**Trigger:** `packages/ai-native/src/browser/chat/AgenticVirtualMessageList.tsx`, `packages/ai-native/src/browser/chat/agentic-conversation-view-model.ts`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/chat/chat.view.acp.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic `history` ACP fixture configured with two Agent Sessions containing 1,000 visible messages each, including variable-height Markdown, reasoning, plan, and tool-call rows. **Workspace mutation:** None. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-long-history-switching.test.ts`; focused view-model and virtual-list behavior is additionally covered by browser Jest tests.

## Given

- Agentic Layout is visible with two Agent-owned Sessions in one available Project.
- Each Session contains exactly 1,000 ordered visible messages with stable message identities.
- Browser-owned ACP Session resources can be released so the next selection must restore history through `session/load`.

## When

1. Release Browser-owned ACP Session resources and reload the IDE.
2. Select Session Alpha and wait for Transcript Ready and Live Ready.
3. Record total history count, visible content identity, mounted row count, and reading position.
4. Select Session Beta while Alpha remains readable.
5. Record Beta content and confirm Alpha-only sentinels are absent after the atomic commit.
6. Scroll Beta away from the bottom, then switch back to Alpha and again to Beta.
7. Expand or collapse variable-height rich content and allow background updates while reading above the bottom.

## Then

- The previous transcript remains visible until the requested Session reaches Transcript Ready; no page-level loading replacement appears.
- Only the latest overlapping selection may become active.
- Each active Session reports exactly 1,000 messages in the canonical history.
- Mounted Agentic message rows remain greater than zero and no greater than 80.
- Alpha and Beta content never mix, duplicate, or change order.
- Warm switching does not replay retained history one message at a time.
- Returning to a Session restores bottom affinity or the stable top-visible-message anchor and viewport offset.
- Dynamic-height changes and background output do not steal the reading position.
- Agentic Layout uses the virtualized message list; Classic ACP Chat retains its existing presentation path.

## Pass / Blocked Judgment

- **PASS** - both 1,000-message Sessions switch atomically with bounded DOM, stable identity, isolated content, and restored reading position.
- **BLOCKED** - the deterministic history-count fixture, stable message selectors, or interactive profile is unavailable.
- **FAIL** - selection clears the readable transcript early, mounts an unbounded list, mixes Session content, duplicates history, loses the reading anchor, or changes Classic behavior.
