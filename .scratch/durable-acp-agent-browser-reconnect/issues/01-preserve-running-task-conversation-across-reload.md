# Preserve one running Task Conversation across Web IDE reload

Status: ready-for-agent

## Parent

[Durable ACP Agent Execution Across Web IDE Reloads](../PRD.md)

## What to build

Deliver the first end-to-end Durable Agent Task path for user stories 1–12, 31–37, and 39–40.

While an ACP prompt is running, closing or replacing the browser RPC connection must detach only that connection's subscriptions. The remote Node/container process must continue to own the ACP Agent service, ACP Thread, Task Conversation, session state, and in-flight prompt.

Add a session attachment operation to the existing AI back-service RPC contract. Reopening the Web IDE must attach the last viewed Task Conversation by its existing session identity, restore its complete in-memory user-visible state, and then continue receiving live ACP updates. Attachment observes the existing session and must never submit or repeat a prompt.

Keep application shutdown behavior intact: disposal by the Node/container lifecycle must still release the ACP Agent service and its child processes.

## Acceptance criteria

- [ ] Given an ACP Thread with an in-flight prompt, disposing its browser RPC back service does not dispose the shared ACP Agent service, terminate the ACP Thread, send `SIGTERM` to the Agent process, or reject the prompt with a connection-closed error.
- [ ] Connection disposal releases that client's status/output subscriptions so stale browser connections do not leak listeners.
- [ ] A replacement browser client can attach to the same ACP session without creating a new session or sending another prompt.
- [ ] The first logical attachment update restores the session's current messages, Agent output, thought content, tool calls, session state, and authoritative ACP Task Status.
- [ ] Updates produced after attachment continue to reach the replacement browser client while the original prompt remains in progress.
- [ ] If the Agent completed or failed while no browser was attached, the replacement client receives the resulting authoritative session state.
- [ ] Reload restoration automatically attaches the last viewed Task Conversation rather than opening a blank conversation or resubmitting its last turn.
- [ ] Disposing the Node/container-owned ACP Agent service still terminates its ACP Threads and child processes.
- [ ] A regression test exercises the browser-to-Node back-service lifecycle seam and reproduces the original disconnect-during-prompt scenario rather than asserting only on the final error text.
- [ ] A Web IDE or equivalent browser integration scenario demonstrates refresh during generation, state restoration, and continued output without Agent interruption.

## Blocked by

None - can start immediately.
