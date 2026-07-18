---
status: proposed
---

# Render ACP status without completion inference

Agentic Layout will render ACP session and thread status rather than maintain a frontend task lifecycle. The visible statuses are `initializing`, `ready`, `running`, `stopping`, `stopped`, and `error`; `ready` means that the ACP Agent is waiting for another prompt and does not imply task completion. Structured ACP requests such as permission or input requests drive attention indicators. The frontend will not infer `completed`, `ready-for-review`, or input requirements from conversation content, file changes, or validation output, and it will render and forward only ACP-advertised Task Actions rather than add its own stop or retry controls.
