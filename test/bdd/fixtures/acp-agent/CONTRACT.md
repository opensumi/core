# ACP BDD Mock Agent Fixture Contract

This contract summarizes the deterministic fixture modes consumed by BDD hardening work. It is based on the `test/bdd/evidence/2026-06-11` blocked reports and the fixture implementation in `mock-acp-agent.mjs`.

## Determinism Rules

- Fixture content is bounded sentinel data only.
- Do not emit raw prompts, assistant free text, secrets, credentials, or unbounded tool output.
- When a scenario needs more than one fixture class, run separate deterministic passes and record the fixture used by each pass.
- Scenario-specific selectors, product controls, browser profile setup, and live-agent prompt behavior are owned by the scenario owner, not by the shared mock agent.

## Fixture Modes

| Fixture | Supported behavior |
| --- | --- |
| `stream-rich` | Bounded user row, thought chunks, plan entries, assistant chunks, tool-call lifecycle, config snapshot, usage, modes, models, config options, and available commands. |
| `long-stream` | Bounded repeated assistant chunks with cancellable pending prompt state and deterministic cancel sentinel. |
| `permission` | Bounded pending tool call plus ACP permission request with allow/reject outcomes reflected as tool-call update and assistant sentinel. |
| `send-failure` | Deterministic `session/prompt` failure. |
| `create-failure` | Deterministic `session/new` failure. |
| `load-failure` | Deterministic `session/load` not-found failure. |
| `auth-required` | Deterministic ACP auth-required prompt failure. |
| `config-failure` | Deterministic `session/set_config_option` failure. |
| `process-exit` | Emits deterministic prompt updates, then exits the ACP agent process with a fixed non-zero code. |
| `history` | Two deterministic seeded sessions, stable list ordering, normal modes/models/config/options, and bounded rich replay on `session/load` using user, thought, plan, assistant, tool-call, tool-result, and usage updates. |

## Capability Matrix

| Scenario | Required fixture mode(s) | Currently supported behavior | Missing behavior / owner request |
| --- | --- | --- | --- |
| `acp-chat-agentic-fallback` | none | Not an ACP mock-agent contract. | Scenario owner needs a yarn-start-safe backend-readiness failure provider where `aiBackService.ready()` rejects. |
| `acp-layout-switch` | none | Not an ACP mock-agent contract. | Scenario owner needs stable user-facing Agentic/Classic layout switch control or a runtime-supported Classic override. |
| `acp-chat-agentic-input-send` | `stream-rich`, `create-failure`, `send-failure` | All named fixture modes exist and are bounded. Recovery subcases are covered in `tools/playwright/src/tests/acp-chat-agentic-error-taxonomy.test.ts`. | Broader input, command, mention, attachment, and scroll subcases remain scenario-owned. |
| `acp-chat-agentic-stream-rendering` | `stream-rich`, `send-failure` | Rich stream and send-failure recovery fixtures exist. | Scenario owner needs scheduled full matrix and stable render selectors. |
| `acp-chat-agentic-cancel-stop` | `long-stream`, `stream-rich` | Long active stream, cancellation sentinel, and follow-up success fixture exist. | Scenario owner needs stable visible stop/cancel selector and scheduled pass. |
| `acp-chat-agentic-rich-history-restore` | `history` | `history` now seeds two sessions and replays bounded rich updates on load. Hardened Playwright coverage exists in `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`. | Reload coverage currently asserts bounded shell recovery because product reload restores transcript rows, not full non-message replay parts. |
| `acp-chat-agentic-permission-during-send` | `permission`, `stream-rich` | Permission request fixture, stable dialog close/reject selectors, active badge/count observability, and full-profile Playwright coverage exist in `tools/playwright/src/tests/permission-dialog.test.ts`. | Same-session non-permission follow-up still uses a separate `stream-rich` pass unless the fixture grows per-prompt branching. |
| `acp-chat-agentic-session-isolation` | `history`, `long-stream`, `stream-rich` | Seeded history, controlled active stream, and completed stream fixtures exist. Hardened history-backed isolation coverage exists in `tools/playwright/src/tests/acp-chat-agentic-session-isolation.test.ts`. | Concurrent long-stream isolation still needs orchestration that preserves an active stream while switching sessions. |
| `acp-chat-agentic-context-attachments` | `stream-rich` | Normal deterministic send shell exists without prompt leakage. | Scenario owner needs stable context picker/attachment selectors and optional rule fixture. |
| `acp-chat-agentic-command-surface` | `stream-rich` | Available command metadata and rich send fixture exist. | Scenario owner needs stable slash picker selection/cancel/send selectors. |
| `acp-chat-agentic-reload-during-stream` | `long-stream`, `stream-rich` | Reloadable active stream and post-reload success fixtures exist. | Scenario owner needs scheduled reload-during-stream pass and stable recovery assertions. |
| `acp-chat-agentic-error-taxonomy` | `create-failure`, `load-failure`, `send-failure`, `auth-required`, `config-failure`, `process-exit`, `stream-rich` | Named failure, retry, process-exit, and recovery fixtures exist. Hardened Playwright coverage exists in `tools/playwright/src/tests/acp-chat-agentic-error-taxonomy.test.ts` for all scheduled deterministic failure fixtures. | No shared mock-agent fixture gap for the scheduled error taxonomy pass. |
| `acp-chat-agentic-layout-stress` | `long-stream`, `stream-rich` | Long content and rich layout subcases exist as separate bounded passes. | Scenario owner should decide whether separate passes are enough; a single combined long-rich fixture remains scenario-specific. |
| `acp-chat-agentic-keyboard-a11y` | `stream-rich`, `history`, `permission` | Tool-card, seeded history, permission fixture, and stable permission dialog dismissal selectors exist. | Scenario owner still needs stable keyboard focus selectors and scheduled keyboard-specific fixture passes. |
| `acp-chat-agentic-debug-log-from-chat` | `stream-rich` | Rich deterministic ACP traffic exists for log correlation. | Product/scenario owner needs debug-log viewer/store pass and redacted render/copy contract. |
| `acp-chat-agentic-theme-persistence` | none | Optional deterministic chat content can use `stream-rich`, but the core contract is not ACP fixture behavior. | Scenario owner needs stable theme/layout preference controls. |
| `acp-chat-agentic-history` | `history`, `stream-rich` | Seeded sessions, stable ordering, rich replay, and normal send fixture exist. Hardened Playwright coverage exists in `tools/playwright/src/tests/acp-chat-agentic-history.test.ts`. | No shared mock-agent fixture gap for the history-backed pass. |
| `acp-chat-agentic-layout-interop` | none | Not an ACP mock-agent contract. | Scenario owner needs stable Agentic/Classic layout switch control; read-only layout checks can proceed separately. |
| `session-mode` | session with `agent` and `chat` modes | Mock-agent session responses include `agent` and `chat` modes and mode updates. | Scenario owner needs to run against deterministic mock session or product must expose required mode state through the full-profile MCP state path. |
| `session-relay` | `history` | `history` now supplies two seeded sessions and bounded replay data; stable permission dialog selectors are available for the relay permission gate. | Scenario owner still needs prepared relay digest state and scheduled relay-specific full-profile coverage. |
| `permission-dialog` | `history`, `permission` | Seeded sessions, deterministic live permission request fixture, stable close/reject selectors, metadata-only permission state checks, and full-profile Playwright coverage exist in `tools/playwright/src/tests/permission-dialog.test.ts`. | No shared mock-agent fixture gap for the direct permission-dialog pass. |
| `webmcp-ide-capability-groups` | none | Not an ACP mock-agent contract. | Scenario owner needs temporary workspace setup and reversible workspace/search/diagnostics/editor mutation matrix. |
| `acp-debug-log` | `stream-rich` | Rich deterministic ACP protocol traffic exists. | Product/scenario owner needs debug-log store/viewer fixture pass and redaction audit support. |
| `acp-error-and-recovery` | `create-failure`, `load-failure`, `send-failure`, `auth-required`, `config-failure`, `process-exit` | Node/service failure fixtures and process-exit coverage exist; visible browser recovery for the deterministic fixture matrix is covered in `tools/playwright/src/tests/acp-chat-agentic-error-taxonomy.test.ts`. | No shared mock-agent fixture gap for the deterministic recovery pass. |

## Scenario-Specific Requests Not Implemented Here

- Backend-readiness failure provider for `acp-chat-agentic-fallback`.
- Stable Agentic/Classic layout switch controls for layout scenarios.
- Stable send, recovery, stop/cancel, command picker, attachment picker, history, and keyboard-focus selectors.
- Combined long-rich fixture unless a future scenario proves separate `long-stream` and `stream-rich` passes are insufficient.
- ACP debug log viewer/store redaction contracts.
- Full-profile reversible workspace/search/diagnostics/editor mutation setup.
