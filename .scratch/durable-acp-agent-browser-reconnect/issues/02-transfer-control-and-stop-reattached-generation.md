# Transfer session control and stop a reattached generation

Status: ready-for-agent

## Parent

[Durable ACP Agent Execution Across Web IDE Reloads](../PRD.md)

## What to build

Deliver the end-to-end control handoff and explicit cancellation path for user stories 16–22.

The most recently attached browser client becomes the single control client for a Task Conversation. Older attached clients may continue observing the session, but they must not be able to submit another prompt or cancel work after control has moved.

Formally expose session-scoped cancellation through the existing AI back-service RPC contract. When a refreshed page attaches to a session whose ACP Task Status is running, it must render the existing generation Stop interaction. Stop cancels the remote in-flight prompt by session identity and does not depend on the browser-local cancellation token created by the original page.

Refresh, disconnect, tab closure, panel closure, and Task Conversation selection changes remain detach operations and must never invoke cancellation implicitly.

## Acceptance criteria

- [ ] Attaching a new browser client to a session transfers write control to that client using the existing RPC client and session identities.
- [ ] A previously controlling client can continue receiving observable session updates after handoff.
- [ ] A stale client cannot submit a prompt after a newer client has taken control.
- [ ] A stale client cannot cancel the session's active generation after a newer client has taken control.
- [ ] The current control client can submit a follow-up prompt when the Task Conversation is ready.
- [ ] A reattached client displays the existing Stop interaction whenever the authoritative ACP Task Status is running.
- [ ] Clicking Stop after a refresh invokes session-scoped cancellation and causes the original remote prompt to enter the normal cancelled/stopped flow.
- [ ] Merely refreshing, disconnecting, closing a page or panel, or selecting another Task Conversation does not call session cancellation.
- [ ] Existing non-reconnect cancellation behavior remains compatible with the browser-local cancellation-token path.
- [ ] Focused browser-to-Node tests cover latest-attachment-wins control, stale-client rejection, and Stop after refresh without relying on private ownership maps.

## Blocked by

- [01 — Preserve one running Task Conversation across Web IDE reload](./01-preserve-running-task-conversation-across-reload.md)
