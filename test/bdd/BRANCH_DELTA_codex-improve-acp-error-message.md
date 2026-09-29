# Branch BDD Delta: `codex/improve-acp-error-message` vs `main`

This document maps user-observable and protocol-observable behavior added or changed on the branch to BDD scenarios. The comparison covers the 21 committed branch commits plus the current Agent Session Archive worktree changes. Pure dependency-lock and internal refactoring changes are covered only through their public behavior.

| Branch behavior | BDD scenario | Layer | Automation |
| --- | --- | --- | --- |
| Agent-owned `session/list` browser, metadata authority, selection, local Archive/Unarchive | `acp-chat-agentic-session-archive-and-restore.scenario.md` | runtime-ui | Playwright converted |
| Agent history restoration after Browser resource release and attachment failure | `acp-chat-agentic-history-restore-after-session-release.scenario.md` | runtime-ui | Playwright converted |
| Rich restored content, Session isolation, and reload preservation | `acp-chat-agentic-rich-history-restore.scenario.md` | runtime-ui | Playwright converted |
| Atomic switching and bounded 1,000-message virtualization | `acp-chat-agentic-long-history-switching.scenario.md` | runtime-ui | Playwright + Jest converted |
| Bounded standby capacity, latest target, cancellation, and first-Prompt commit boundary | `acp-standby-capacity-and-session-launch.scenario.md` | node-contract | Jest converted |
| Stop/cancel status synchronization and same-Session follow-up | `acp-chat-agentic-cancel-stop.scenario.md` | runtime-ui | Playwright converted |
| Actionable localized create/load/send/service/model/auth/config/process errors | `acp-chat-agentic-error-taxonomy.scenario.md` and `acp-error-and-recovery.scenario.md` | runtime-ui + node-contract | Playwright + Jest converted |
| Restored and update-driven ACP Slash Command catalogs | `acp-chat-agentic-command-surface.scenario.md` and `available-commands.scenario.md` | runtime-ui + mcp-contract | Runtime/MCP + Jest |
| Draft-bound ACP Session capability gating and cleanup | `acp-chat-agentic-draft-footer.scenario.md` and `acp-agent-session-lifecycle.scenario.md` | runtime-ui + node-contract | Runtime + Jest |
| Cross-Project Session activation without workspace navigation | `acp-chat-agentic-cross-project-session-activation.scenario.md` | runtime-ui | Playwright converted |
| Layout, resize, maximize, reload, and Classic isolation | `acp-chat-agentic-layout-interop.scenario.md`, `acp-chat-agentic-header-maximize.scenario.md`, and `acp-layout-switch.scenario.md` | runtime-ui | Playwright/runtime |
| Temporary Playwright workspace and preference isolation | `playwright-workspace-isolation.scenario.md` | node-contract | Playwright unit converted |

## Branch acceptance

Given `main` behavior as the baseline, when the branch suite runs against deterministic ACP fixtures, then:

- Agentic Layout uses Agent-owned Sessions rather than legacy Durable Task records as history authority.
- Session switching and restoration preserve readable history, active identity, isolation, and reading position.
- Large histories remain bounded in the mounted DOM without changing message presentation.
- Session launch and standby process management remain within global capacity and recover drafts on pre-commit cancellation/failure.
- Errors provide localized actionable recovery without raw protocol leakage.
- Slash Command catalogs remain scoped to and refreshed by their originating Agent Session.
- Local Archive changes presentation only and never closes or deletes the Agent-owned Session.
- Classic ACP Chat and the surrounding IDE workspace/layout remain behaviorally isolated from Agentic-only changes.
- Test runs do not share or leak temporary workspace/preferences state.

The branch is BDD-complete when every mapped converted test passes and every non-converted runtime scenario is either executed successfully or explicitly marked BLOCKED with its missing deterministic fixture or stable selector.
