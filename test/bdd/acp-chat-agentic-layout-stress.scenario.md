# Scenario: ACP Chat Agentic Layout Stress - Long Content and Dense UI

**Trigger:** `packages/ai-native/src/browser/layout/ai-layout.tsx`, `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/components/acp/ChatReply.tsx`, or `packages/ai-native/src/browser/components/ChatToolRender.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent uses `--fixture=long-stream` for long active content and `--fixture=stream-rich` for reasoning/plan/tool-card layout assertions, optionally a real LLM-backed ACP agent covers live populated-chat layout, and the workspace has Explorer visible. A single long-rich fixture is still required if the run must assert long text, long reasoning, long plan, and long tool result in one pass. **Workspace mutation:** None. **Automation status:** Partially converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-layout-stress.test.ts` using `fixture=long-stream` and `profile=interactive`; long-rich reasoning/plan/tool-result and full layout round-trip assertions remain blocked until a combined fixture or separate stable passes cover them.

## Given

- Agentic AI Chat and Explorer/workbench are visible.
- The mock `long-stream` fixture can emit long bounded content without relying on an LLM; the mock `stream-rich` fixture covers reasoning, plan, and tool-card shape.
- Live-agent mode may provide populated chat evidence only when the generated model output is treated as variable and redacted evidence.

## When

1. Send a deterministic long-content prompt.
2. Wait for long text, reasoning, plan, and tool result to render.
3. Record AI Chat, workbench, Explorer, input, history, and status bar geometry.
4. Resize the Agentic AI Chat/workbench splitter smaller and larger within allowed bounds.
5. With the workbench visible, resize the browser viewport below the responsive breakpoint to `900px`, record the temporary collapsed layout, then restore it to `1366px` and record the restored workbench.
6. Explicitly hide/maximize the workbench, repeat the `900px -> 1366px` viewport round trip, and record that the workbench remains hidden.
7. Expand and collapse the long tool result and reasoning sections.
8. Scroll up and down in the message list.
9. Switch Agentic to Classic and back to Agentic.

## Then

- Long content wraps or scrolls inside the chat surface without overlapping the input, history, Explorer, or status bar.
- AI Chat width remains within Agentic bounds and workbench remains usable.
- Below `980px`, the workbench temporarily collapses and AI Chat remains usable without horizontal page overflow; returning above the breakpoint restores the user's previously requested workbench visibility.
- A workbench that was explicitly hidden before the responsive round trip remains hidden after the viewport grows again.
- Tool result expansion does not resize the page into an unusable layout.
- Message list scroll remains usable and bottom-scroll behavior does not jump unexpectedly after manual upward scroll.
- Layout switching preserves visible chat content or restores it safely without duplicate rows.
- No fatal UI text or uncaught stack appears.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that populated live responses do not break scrolling, resizing, expansion/collapse, or Agentic/Classic layout round trips.
- Live-agent mode must not assert exact long text, reasoning, plan, tool-card content, or scroll positions derived from generated output. Dense-content and tool-result layout hardening remains deterministic-fixture only.

## Deterministic Playwright Coverage

- `tools/playwright/src/tests/acp-chat-agentic-layout-stress.test.ts` runs `loadAcpBddFixtureWorkbench({ fixture: 'long-stream', profile: 'interactive' })`.
- Covered: visible long-stream sentinel content, scoped Stop affordance during active streaming, Agentic chat bounds, both visible and explicitly-hidden `900px -> 1366px` responsive paths, message row horizontal containment, page horizontal overflow absence, message viewport scrollability, and message viewport/input separation.
- Remaining blocked for this scenario: long reasoning, long plan, long tool result expansion/collapse, splitter drag bounds, manual scroll-position behavior, Agentic/Classic round trip content preservation, and no-fatal-text checks for the long-rich path.

## Pass / Fail Judgment

- **PASS** - dense Agentic chat content remains readable and layout-stable across resize, scroll, expansion, and layout switching.
- **BLOCKED** - the run lacks interactive profile, the required mock ACP agent fixture pass, a combined long-rich fixture for one-pass assertions, or stable layout selectors.
- **FAIL** - content overlaps controls, splitter bounds fail, scrolling breaks, or layout switching loses the chat surface.
