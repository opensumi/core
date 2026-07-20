---
status: accepted
---

# Bind Agent Tasks to the originating ACP Agent

An Agent Task remains bound to the ACP Agent that created its Task Conversation. If that Agent becomes unavailable, Agentic Layout retains the Task and reports the Agent as unavailable instead of attempting to load the ACP session through the current or default Agent, because ACP session identity and history are Agent-specific and an automatic fallback could misroute execution context, credentials, or permissions.
