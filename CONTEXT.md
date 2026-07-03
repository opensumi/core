# OpenSumi Core

OpenSumi core is the IDE platform context for browser, node, extension, and AI-native workbench behavior.

## Language

**ACP Intermediate Output**: Non-final ACP Chat output produced while an agent is working, before the final assistant response or a user interaction request. _Avoid_: logs, terminal output, IDE logger output

**Minimal ACP Delivery**: The default ACP Chat delivery mode where intermediate output is not delivered to the browser, while final assistant responses, distinct status changes, and user interaction requests remain visible. _Avoid_: frontend-only hiding, full streaming

**Streaming ACP Delivery**: An ACP Chat delivery mode for diagnostics where intermediate output remains visible as it is produced. _Avoid_: default delivery, minimal delivery

**Final ACP Response**: The complete assistant response delivered after an ACP Chat request finishes successfully. _Avoid_: truncated response, intermediate output

**ACP Available Command**: Session-scoped command metadata exposed by an ACP agent for the active ACP Chat session. _Avoid_: Codex skill, MCP tool, command palette action

**Chat Slash Command**: A user-selectable `/` command in the chat input that represents an intended chat action before the message is sent. _Avoid_: shell command, command palette action, MCP tool

**Agentic Layout**: An AI-native panel layout where ACP Chat is treated as the primary agent workspace beside the workbench. _Avoid_: agent layout, agent mode

**Classic Layout**: The standard AI-native panel layout where ACP Chat remains a secondary panel alongside the regular IDE workbench. _Avoid_: IDE layout, old layout, standard layout

**ACP Permission Request**: A user decision prompt raised by ACP Chat when an agent asks to run a tool operation that requires approval. It remains a user decision until the user allows, rejects, cancels, or the owning session ends. _Avoid_: permission notification, unread permission, timed approval

**Pending ACP Permission**: An ACP Permission Request that is still waiting for the user to allow, reject, cancel, or otherwise resolve it. _Avoid_: permission badge, unresolved approval, expired approval

**ACP Permission Title Indicator**: A browser tab title indicator that shows the count of Pending ACP Permissions while the user is in the Agentic Layout on the web. _Avoid_: unread notification, permission notification badge
