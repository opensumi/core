---
status: proposed
---

# Agent Tasks survive the browser lifecycle

Agent Tasks in Agentic Layout will be durable server-side work. Switching Workspaces, reloading or closing the Web IDE page, and temporary browser disconnection must not implicitly cancel an active Task. Reopening Agentic Layout must recover the Task's current state and conversation history so a Workspace-aware Task Switch can restore the selected ACP session.
