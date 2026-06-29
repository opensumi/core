# OpenSumi Core

OpenSumi core is the IDE platform context for browser, node, extension, and AI-native workbench behavior.

## Language

**ACP Intermediate Output**: Non-final ACP Chat output produced while an agent is working, before the final assistant response or a user interaction request. _Avoid_: logs, terminal output, IDE logger output

**Minimal ACP Delivery**: The default ACP Chat delivery mode where intermediate output is not delivered to the browser, while final assistant responses, distinct status changes, and user interaction requests remain visible. _Avoid_: frontend-only hiding, full streaming

**Streaming ACP Delivery**: An ACP Chat delivery mode for diagnostics where intermediate output remains visible as it is produced. _Avoid_: default delivery, minimal delivery

**Final ACP Response**: The complete assistant response delivered after an ACP Chat request finishes successfully. _Avoid_: truncated response, intermediate output
