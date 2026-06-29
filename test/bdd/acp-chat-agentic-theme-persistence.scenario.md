# Scenario: ACP Chat Agentic Theme Persistence - Layout and Visual State

**Trigger:** `packages/ai-native/src/browser/layout/ai-layout.tsx`, `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** Fresh browser profile or cleared Agentic layout storage, IDE dev server, Common Preflight, optional deterministic chat session, and optionally a real LLM-backed ACP agent for live populated-chat visual smoke coverage. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP; blocked if theme/layout preference controls are unavailable. Live-agent content is optional and must not gate theme/layout persistence assertions.

## Given

- The IDE can start in Agentic layout.
- Theme and panel layout preferences can be changed through supported user-facing UI or preference APIs.

## When

1. Open the workspace in Agentic layout.
2. Record layout label, AI Chat/workbench geometry, theme class or visible theme marker, and chat view visibility.
3. Switch theme from the current theme to another supported theme.
4. Record AI Chat header, input, message list, history, and tool-card visual readability.
5. Resize Agentic AI Chat within bounds.
6. Reload the page.
7. Record whether Agentic layout, theme, chat visibility, and resized geometry persist or safely restore to supported defaults.
8. Switch Agentic to Classic and back to Agentic, then record final visual state.

## Then

- Theme changes do not hide or make unreadable the Agentic chat header, input, history, or message rows.
- Agentic layout remains the selected layout after reload unless the profile explicitly resets preferences.
- AI Chat and workbench geometry remain within supported bounds after reload.
- Switching Classic back to Agentic restores the leftmost AI Chat layout.
- No visible text overlaps, zero-size chat slot, or fatal startup text appears.

## Live Agent Execution

- A real LLM-backed ACP agent may populate the chat surface before theme, resize, reload, and layout round-trip checks to provide live visual evidence.
- Live-agent mode must not assert generated assistant text or exact restored message content. Theme readability, preference persistence, geometry, and layout round-trip checks remain model-output independent.

## Pass / Fail Judgment

- **PASS** - Agentic layout and theme state remain visually usable across theme change, resize, reload, and layout round trip.
- **BLOCKED** - the run lacks default profile, theme/layout controls, or browser storage access needed for validation.
- **FAIL** - theme breaks readability, Agentic preference is lost, geometry escapes bounds, or the chat slot becomes unusable.
