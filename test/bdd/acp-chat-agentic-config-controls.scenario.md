# Scenario: ACP Chat Agentic Footer Config Options - Session Config Controls

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Source:** [ACP Session Config Options](https://agentclientprotocol.com/protocol/v1/session-config-options)

**Layer:** `runtime-ui` **Required profile:** `full` **Fixtures:** Agentic startup has passed, and the deterministic ACP fixture is configured with `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich`. The fixture exposes `configOptions` with stable ids for `mode`, `model`, `thought_level`, and a boolean fixture option; each selectable option has at least two values and a current value. Deterministic fixture mode records outbound `session/set_config_option` calls through ACP Debug Log and emits a prompt-turn `BDD_CONFIG_SNAPSHOT` without exposing raw prompt bodies. A fresh MCP session runs in a full profile exposing the required `acp_chat` tools. **Workspace mutation:** None. **Automation status:** Automated through Playwright full-profile runtime plus ACP Debug Log proof records and deterministic fixture stream assertions; live-agent runs may cover visible controls and safe state only, while send-time config snapshots and conversion require deterministic fixture records.

## Given

- Agentic AI Chat is visible.
- The active ACP session state includes a `configOptions` list returned by the ACP agent. The list includes:
  - An option with `category: "mode"` and a current value rendered as the first footer selector.
  - An option with `category: "model"` and a current value rendered as the second footer selector, for example `qwen3.6-plus`.
  - An option with `category: "thought_level"` and a current value rendered as another footer selector.
- The footer derives mode/model/thought controls from `configOptions` when that list is present; legacy `agentModes` and `agentModels` selectors must not render duplicate controls in the same footer.
- The fixture supports reversible UI changes for every visible ACP config option.

## When

1. Open the Agentic chat input footer and record every visible config selector label, selected value, disabled state, and keyboard focus order.
2. Assert the visible selector count and labels match the normalizable ACP `configOptions` entries in agent-provided order, including options categorized as `mode`, `model`, and `thought_level`.
3. For each required config option, open the footer combobox, select a non-current value, and record the visible value immediately after selection.
4. For each selection, verify the client sent `session/set_config_option` with the active ACP `sessionId`, the exact `configId`, and the selected value. Boolean config options, when present, must send boolean values rather than stringified labels.
5. Verify the agent response supplies a complete `configOptions` list and the footer refreshes from that returned list. If the returned list changes labels, ordering, disabled options, or current values, the footer must reflect the returned list rather than a locally patched single value.
6. Send a deterministic prompt after changing `mode`, `model`, and `thought_level`. Record the fixture prompt-turn config snapshot without asserting assistant text.
7. Record the controls while the prompt is sending, then wait for completion and record final controls, safe session summary, and input state.
8. Restore the original config option values if the fixture requires cleanup.

## Then

- Footer controls render only values exposed by the active ACP session `configOptions`.
- The `mode`, `model`, and `thought_level` category changes visibly take effect in the footer and are confirmed by `session/set_config_option` call records using each option's exact `id` as `configId`.
- The sent prompt-turn uses the currently selected config option values. The scenario must not pass if the UI label changes but the outbound ACP config remains unchanged.
- While streaming, footer controls either remain safely usable according to the ACP config option contract or disable only unsafe changes; the selected values must not silently revert.
- Controls become usable again after stream completion or failure.
- Switching config options does not create duplicate sessions, clear existing visible messages, or render duplicate legacy mode/model selectors.
- State tools expose safe metadata only, including optional bounded session title metadata, and do not leak message bodies, assistant text, tool-call output, or config secrets.

## Live Agent Execution

- A real LLM-backed ACP agent may verify visible `configOptions` rendering, selection affordances, disabled/loading behavior, returned safe state metadata, and absence of duplicate legacy mode/model controls when it exposes stable option ids and values.
- Live-agent mode must not assert generated assistant text, hidden config secrets, exact prompt-turn effects, or outbound `session/set_config_option` call records unless those records are captured by a deterministic fixture or protocol recorder. Send-time config hardening remains deterministic-fixture only.

## Pass / Fail Judgment

- **PASS** - Agentic footer config controls render from ACP `configOptions`, each required option calls `session/set_config_option`, returned `configOptions` refresh the footer, send-time config uses the selected values, and safe session-state reads remain metadata-only.
- **BLOCKED** - the run lacks full profile, deterministic `mode`/`model`/`thought_level` config fixtures, fixture call records, or stable footer control selectors.
- **FAIL** - controls are missing, duplicated, stale, only locally patched when the agent returns a different complete list, ineffective at send time, unsafe during send, unexpectedly duplicate/clear sessions, or state tools leak sensitive values.
