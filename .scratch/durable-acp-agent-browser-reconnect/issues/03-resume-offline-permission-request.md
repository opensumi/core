# Resume an offline Permission Request after reconnect

Status: ready-for-agent

## Parent

[Durable ACP Agent Execution Across Web IDE Reloads](../PRD.md)

## What to build

Deliver the end-to-end offline Permission Request path for user stories 23–26.

When an ACP Agent raises a Permission Request while no browser control client is available, retain the unresolved request in Node-owned Task Conversation state. Browser RPC disconnection must not automatically allow, reject, cancel, or otherwise resolve the request.

When a new control client attaches, present the original Permission Request and the Agent-provided Permission Decisions. The Agent remains paused until the control client selects a decision. Resolve the Agent request exactly once, even if stale clients reconnect or duplicate UI actions occur.

Normal explicit Agent Task cancellation and Node/container shutdown may still cancel unresolved permission work as part of their existing cleanup semantics.

## Acceptance criteria

- [ ] A Permission Request raised with no active browser client remains pending instead of failing immediately or resolving as cancelled.
- [ ] Disconnecting the browser while a Permission Request dialog is open leaves the Agent-side request unresolved.
- [ ] The pending request retains the session identity, tool-call identity, descriptive payload, and exact Agent-provided decision options required for redisplay.
- [ ] The current control client receives the pending Permission Request when it attaches to the Task Conversation.
- [ ] The reattached UI presents the same allow/reject once-or-always choices supplied by the Agent.
- [ ] Selecting a decision resolves the Agent request and updates the corresponding tool-call state exactly once.
- [ ] Responses from stale clients or duplicate responses cannot resolve or overwrite an already completed Permission Decision.
- [ ] No timeout automatically grants or rejects the request while the remote Node/container process remains alive.
- [ ] Explicit session cancellation or Node/container shutdown cleans up unresolved permission state without leaking promises or dialogs.
- [ ] Focused permission-routing and browser integration tests cover disconnect-before-decision and reconnect-to-decide behavior through public service boundaries.

## Blocked by

- [01 — Preserve one running Task Conversation across Web IDE reload](./01-preserve-running-task-conversation-across-reload.md)
- [02 — Transfer session control and stop a reattached generation](./02-transfer-control-and-stop-reattached-generation.md)
