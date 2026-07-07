# OpenSumi Core

OpenSumi core is the IDE platform context for browser, node, extension, and AI-native workbench behavior.

## Language

**ACP Intermediate Output**: Non-final ACP Chat output produced while an agent is working, before the final assistant response or a user interaction request. _Avoid_: logs, terminal output, IDE logger output

**Minimal ACP Delivery**: An opt-in low-volume ACP Chat delivery mode where ACP Intermediate Output is not delivered to the browser, while final assistant responses, ACP Safe Progress Signals, and user interaction requests remain visible. _Avoid_: frontend-only hiding, default delivery, silent delivery

**Streaming ACP Delivery**: The default ACP Chat delivery mode where intermediate output remains visible as it is produced. _Avoid_: diagnostics-only delivery, minimal delivery

**Final ACP Response**: The complete assistant response delivered after an ACP Chat request finishes successfully. _Avoid_: truncated response, intermediate output

**ACP Safe Progress Signal**: Low-volume, non-sensitive ACP Chat progress, such as status, aggregated plan progress, or tool activity labels, that helps the user understand that the agent is still working without exposing ACP Intermediate Output or becoming part of the Final ACP Response. _Avoid_: thought text, raw reasoning, partial answer text, raw plan item text, raw tool input, raw tool output

**ACP Available Command**: Session-scoped command metadata exposed by an ACP agent for the active ACP Chat session. _Avoid_: Codex skill, MCP tool, command palette action

**ACP Agent Type**: A user-selectable ACP runtime family that ACP Chat uses to choose which agent handles ACP sessions. _Avoid_: chat agent, model, layout

**ACP Agent Configuration**: User-editable launch settings that define ACP Agent Types available to ACP Chat, such as command, arguments, and description. _Avoid_: ACP runtime override, chat agent metadata, model configuration

**Chat Slash Command**: A user-selectable `/` command in the chat input that represents an intended chat action before the message is sent. _Avoid_: shell command, command palette action, MCP tool

**Agentic Layout**: An AI-native panel layout where ACP Chat is treated as the primary agent workspace beside the workbench. _Avoid_: agent layout, agent mode

**Agentic Workbench**: The regular IDE workbench surface that can appear beside ACP Chat in the Agentic Layout. _Avoid_: agent editor pane, IDE side, hidden workbench area

**Collapsed Agentic Workbench**: An Agentic Layout state where ACP Chat is the only visible main workspace and the Agentic Workbench is hidden. _Avoid_: agent chat fullscreen, full-screen chat

**Classic Layout**: The standard AI-native panel layout where ACP Chat remains a secondary panel alongside the regular IDE workbench. _Avoid_: IDE layout, old layout, standard layout

**Editor-hosted Workbench Target**: A foreground destination that must be viewed or operated inside the workbench editor area. _Avoid_: hidden editor target, invisible settings, agentic fallback view

**ACP Permission Request**: A user decision prompt raised by ACP Chat when an agent asks to run a tool operation that requires approval. It remains a user decision until the user allows, rejects, cancels, or the owning session ends. _Avoid_: permission notification, unread permission, timed approval

**Pending ACP Permission**: An ACP Permission Request that is still waiting for the user to allow, reject, cancel, or otherwise resolve it. _Avoid_: permission badge, unresolved approval, expired approval

**ACP Permission Title Indicator**: A browser tab title indicator that shows the count of Pending ACP Permissions while the user is in the Agentic Layout on the web. _Avoid_: unread notification, permission notification badge

**Regression Signal**: A test's ability to fail when a user-visible workflow or integration contract regresses, even if the test uses stability helpers internally. _Avoid_: test stability, implementation coverage, fixture convenience
