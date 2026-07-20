# Durable ACP Agent Execution Across Web IDE Reloads

Status: ready-for-agent

## Problem Statement

Developers use OpenSumi as a Web IDE to run ACP Agents on long-lived work inside a remote container. Today, the browser RPC connection owns too much of the Agent lifecycle: when the page refreshes, a WebSocket reconnect occurs, or the browser temporarily disconnects, disposal of the connection-scoped back service can dispose the shared ACP Agent service. That disposal terminates active ACP Threads with `SIGTERM`, closes the ACP connection while a prompt is still running, and surfaces `ACP agent connection closed while waiting for prompt response.`

From the developer's perspective, an ordinary browser lifecycle event can therefore destroy a long-running Agent Task even though the remote container and Node backend remain healthy. Reloading the page cannot safely reattach to the running Task Conversation, receive subsequent output, resolve a pending Permission Request, or explicitly stop the original generation. Multiple active Agent Tasks may also be terminated together when one RPC connection is disposed.

This behavior conflicts with the Durable Agent Task model: browser reloads, page closure, and temporary disconnection must not implicitly cancel server-side Agent work.

## Solution

Decouple ACP Agent execution from the browser RPC connection lifecycle. ACP Threads and Task Conversations remain owned by the remote Node/container process, while each browser connection only owns its subscriptions and control attachment.

When the browser disconnects, active ACP Agents continue running indefinitely for the lifetime of the Node/container process. Reloading the Web IDE reattaches the last viewed Task Conversation by its existing ACP session identity. The reattachment first restores the complete in-memory session snapshot and then continues delivering real-time updates without starting another prompt.

The most recently attached browser becomes the single control client for the session, while other connected pages may continue observing. A reattached developer can explicitly stop the running generation through the existing Stop interaction. Permission Requests that arise while no browser is connected remain pending and are presented when a control client reattaches.

The solution deliberately uses the existing OpenSumi RPC infrastructure and in-memory ACP session state. It does not add HTTP endpoints, durable event journals, browser authentication, or recovery across Node/container restarts.

## User Stories

1. As a Web IDE developer, I want an Agent Task to continue running when I refresh the page, so that long-running work is not destroyed by normal browser usage.
2. As a Web IDE developer, I want an Agent Task to continue running when my network temporarily disconnects, so that transient connectivity does not cancel remote work.
3. As a Web IDE developer, I want an Agent Task to continue running when I close its browser tab, so that the remote container can finish work while no page is open.
4. As a Web IDE developer, I want switching to another Task Conversation to leave the previous Agent Task running, so that I can monitor and manage concurrent work.
5. As a Web IDE developer, I want closing the Agentic Chat View or chat panel to detach only the UI, so that presentation lifecycle does not control Agent execution.
6. As a Web IDE developer, I want the last viewed Task Conversation to restore automatically after reload, so that I return to the work I was watching.
7. As a Web IDE developer, I want a restored Task Conversation to use the same ACP session, so that follow-up turns continue the original objective and context.
8. As a Web IDE developer, I want reattachment to avoid sending the last prompt again, so that refresh cannot duplicate Agent actions or file changes.
9. As a Web IDE developer, I want the restored conversation to include all user-visible messages, Agent output, thought content, tool calls, and current statuses, so that the page accurately reflects remote work.
10. As a Web IDE developer, I want to receive new Agent output after reattachment, so that a still-running task remains live rather than becoming a static replay.
11. As a Web IDE developer, I want a task that completed while I was offline to appear completed or ready when I return, so that I can see its final state without restarting it.
12. As a Web IDE developer, I want a task that failed while I was offline to show its authoritative ACP error state when I return, so that failure is not mistaken for a browser problem.
13. As a Web IDE developer, I want all other running Agent Tasks to remain visible after reload, so that background work is not lost merely because only one Task Conversation is selected.
14. As a Web IDE developer, I want only the last viewed Task Conversation to attach its full live output automatically, so that reconnecting does not create unnecessary streams for every background task.
15. As a Web IDE developer, I want selecting another running Agent Task to attach to it on demand, so that I can move between concurrent tasks without restarting them.
16. As a Web IDE developer, I want the newest attached page to control the Task Conversation, so that a refreshed page can safely take over from a stale connection.
17. As a Web IDE developer, I want stale or older pages to be prevented from sending new prompts after control has moved, so that network partitions cannot create conflicting turns.
18. As a Web IDE developer, I want stale or older pages to be prevented from cancelling the current generation, so that only the current control client can stop work.
19. As a Web IDE developer, I want non-controlling pages to continue observing Agent output, so that multiple views can monitor a Task Conversation without introducing multiple writers.
20. As a Web IDE developer, I want the existing Stop control to remain available after refresh when the ACP Task Status is running, so that I can explicitly cancel the original generation.
21. As a Web IDE developer, I want Stop to cancel the server-side ACP prompt identified by the session, so that cancellation does not depend on a browser-local cancellation token that was lost during reload.
22. As a Web IDE developer, I want refresh, disconnect, panel closure, and Task selection changes never to invoke Stop implicitly, so that cancellation always represents explicit user intent.
23. As a Web IDE developer, I want a Permission Request raised while I am offline to remain unresolved, so that OpenSumi neither grants nor rejects protected work on my behalf.
24. As a Web IDE developer, I want a pending Permission Request to reappear when I reattach, so that I can continue the paused Agent Task safely.
25. As a Web IDE developer, I want the Agent to wait indefinitely for an offline Permission Decision, so that a long absence does not silently change the task outcome.
26. As a Web IDE developer, I want Agent-provided permission choices to remain unchanged after reconnect, so that I decide among the same allow/reject options the Agent originally supplied.
27. As a Web IDE developer, I want a running ACP Thread to be excluded from timeout and LRU cleanup, so that long generations are never killed for exceeding a keepalive period.
28. As a Web IDE developer, I want idle ACP processes to remain eligible for thread-pool recycling, so that historical sessions do not permanently consume one process each.
29. As a Web IDE developer, I want an idle session whose process was recycled to remain loadable later, so that resource management does not delete the Task Conversation.
30. As a Web IDE developer, I want closing one RPC connection to leave Agent Tasks used by other connections untouched, so that one page cannot terminate unrelated work.
31. As a Web IDE developer, I want the remote container or Node process shutting down to stop its Agent Tasks, so that execution does not claim durability beyond its actual runtime owner.
32. As a Web IDE developer, I want a Node/container restart to be reported as a stopped or disconnected task rather than silently reconstructed, so that the product does not promise unsupported cross-process recovery.
33. As an OpenSumi maintainer, I want browser connection cleanup to release only connection-scoped subscriptions and clients, so that shared ACP execution state has one clear owner.
34. As an OpenSumi maintainer, I want ACP Agent shutdown to remain available from the Node/container lifecycle, so that application shutdown still releases child processes and resources.
35. As an OpenSumi maintainer, I want reconnect behavior to reuse existing RPC conventions, so that browser/node boundaries remain consistent with the rest of OpenSumi.
36. As an OpenSumi maintainer, I want reconnect state to come from ACP session and thread state, so that the frontend does not infer task lifecycle from incomplete chat output.
37. As an OpenSumi maintainer, I want the solution to use the existing in-memory session snapshot, so that browser reload support does not introduce a second persistence system.
38. As an OpenSumi maintainer, I want reattachment to tolerate a small number of duplicate updates, so that the implementation can remain simple while the frontend merges updates by their existing message or tool-call identity.
39. As an OpenSumi maintainer, I want connection subscriptions to be disposed when their RPC client disappears, so that durable Agent execution does not leak listeners for old pages.
40. As an OpenSumi maintainer, I want explicit tests for the original `SIGTERM` regression, so that a future lifecycle refactor cannot reconnect browser disposal to Agent disposal.

## Implementation Decisions

- ACP Agent execution is container-scoped rather than browser-connection-scoped. The shared ACP Agent service, its session-to-thread mappings, running prompts, and thread pool live until the Node/container lifecycle disposes them.
- Disposing a connection-scoped ACP back service detaches only that client's status, output, permission, and RPC subscriptions. It must not dispose the shared ACP Agent service or terminate ACP Threads.
- The root Node/container lifecycle remains responsible for final ACP Agent service disposal and child-process termination.
- A Durable Agent Task contains one Task Conversation backed by one ACP session. Reattachment uses that existing session identity and never creates a replacement session merely because the browser connection changed.
- The existing browser/node RPC transport remains the only transport for this feature. No HTTP endpoint or second streaming mechanism is introduced.
- The existing AI back-service RPC contract gains an `attachSession` operation. It does not submit a prompt. Its first logical update contains the complete current in-memory session snapshot; subsequent updates contain real-time ACP session notifications and status changes.
- Session attachment establishes the live subscription before finalizing snapshot delivery so that updates occurring during reattachment are not lost. A small connection-local buffer may bridge this attach boundary; no durable event journal, acknowledgement protocol, or replay cursor is introduced.
- The existing AI back-service RPC contract formally exposes `cancelSession`. A reattached UI uses this session-scoped operation because the browser-local cancellation token from the original request does not survive reload.
- Starting a prompt and observing a session are separate responsibilities. The existing prompt-send operation starts a new turn; `attachSession` observes an already existing Task Conversation.
- The most recently attached browser client is the single control client for a session. It may submit prompts, cancel the active generation, and answer Permission Requests. Older attached clients may observe but their control operations are rejected or ignored as stale.
- The control lease is keyed by the existing RPC client identity and session identity. The environment is single-container, single-user, so the feature adds no user authentication or authorization model.
- Browser disconnect, reload, tab closure, panel disposal, and Task selection changes detach the client without cancelling the ACP prompt or disposing the ACP Thread.
- Explicit Stop is the only browser action that cancels active generation. It remains the existing generation-level Stop interaction and must not be presented as a synthetic ACP Task Action.
- Running ACP Threads are pinned and never participate in timeout-based or LRU cleanup. Idle and awaiting-prompt threads remain eligible for existing pool recycling when capacity is required.
- Recycling an idle process does not delete the ACP session or Agent Task. A later selection may load the same session into an eligible thread.
- Reconnection automatically attaches only the last viewed Task Conversation. Other Agent Tasks continue running remotely and expose authoritative ACP Task Status; selecting one attaches its full conversation stream on demand.
- The frontend rebuilds the selected Agentic Chat View from the server-provided session snapshot and then applies live updates. ACP session and thread state remain authoritative; the frontend does not infer running, stopped, error, or permission state from message text or elapsed time.
- No raw token timing history is retained. Reattachment guarantees restoration of user-visible conversation state, tool-call state, Permission Requests, and ACP Task Status rather than exact reproduction of the original delivery timeline.
- Existing message, tool-call, and session identities are used to merge any updates duplicated around the snapshot/live boundary. A new general-purpose event sequencing subsystem is not added.
- A Permission Request that cannot reach a browser remains pending in Node-owned session state. It is neither automatically allowed nor automatically rejected. The current control client receives it after reattachment and returns one of the Agent-provided Permission Decisions.
- Pending Permission Request state retains the request payload and resolver required to present the same choices after reconnect. Disposing a browser RPC client must not resolve the Agent's request as cancelled.
- The feature is compatible with Node/container process lifetime only. Cross-process recovery, Agent process resurrection, and resuming a prompt after Node/container restart are not promised.
- Public or shared RPC contract changes remain runtime-neutral and follow existing OpenSumi common/browser/node boundaries. Browser code does not import Node implementation state, and Node code does not depend on browser implementation modules.
- The implementation must remain narrowly scoped to ACP lifecycle, attachment, permission routing, and the existing Agentic Chat restoration flow. It must not alter general IDE Layout, workspace, editor, or file-tree lifecycle.

## Testing Decisions

- The primary test seam is the existing browser-to-Node ACP back-service boundary. An integration-style test creates an in-flight prompt, simulates disposal of one browser RPC connection, attaches a replacement client, and asserts externally observable behavior: the prompt remains active, no Agent process termination occurs, the replacement receives the current snapshot and later updates, and the original prompt is not sent twice.
- The primary regression test must reproduce the original lifecycle failure rather than mock only the final error string. Closing the connection-scoped service while a prompt is working must not call shared Agent shutdown, dispose the thread, or cause the prompt to reject with a connection-closed error.
- The same seam verifies multiple sessions: disconnecting one browser client must not terminate any running or idle session owned by the container-scoped ACP Agent service.
- Focused back-service contract tests verify that `attachSession` observes without starting a prompt, emits a snapshot before normal live consumption, cleans up only its own listeners on disconnect, and permits a new client to take control.
- Focused Agent service tests verify latest-attachment-wins control behavior, rejection of stale prompt/cancel/permission operations, running-thread protection from LRU recycling, and continued recycling of idle or awaiting-prompt threads.
- Focused Permission Routing tests verify that an unavailable browser leaves the Permission Request pending, a newly attached control client receives the original request and choices, and exactly one Permission Decision resolves the Agent request.
- Focused browser chat tests verify that reload restoration hydrates the complete selected Task Conversation, does not create or resend a turn, automatically attaches only the last viewed session, and preserves other running sessions for later selection.
- Focused browser cancellation tests verify that a reattached running session renders the existing Stop interaction and that using it invokes session-scoped cancellation even though the original browser cancellation token no longer exists.
- A real Web IDE or Playwright/BDD scenario verifies browser refresh during a long-running Agent turn. The scenario must confirm that the Task Conversation restores, output continues, and the Agent is not interrupted by `SIGTERM`.
- A real Web IDE or Playwright/BDD scenario verifies a Permission Request raised while the page is disconnected and resolved after reload.
- Tests assert externally visible lifecycle and protocol behavior rather than private maps, listener counts, or implementation-specific method ordering. Private-state assertions are acceptable only where existing focused unit-test conventions require them to make process termination observable.
- Existing ACP thread, ACP Agent service, ACP CLI back-service, permission routing, chat manager, and Agentic runtime tests provide prior art. Verification should use their established mocks and streaming helpers rather than introduce a parallel test framework.
- Because the feature changes a shared RPC contract and browser/node lifecycle behavior, verification includes focused TypeScript contract checking and the narrowest affected package build in addition to Jest and runtime coverage.

## Out of Scope

- Preventing all network disconnections or making WebSocket transport itself infallible.
- Resuming a running prompt after the OpenSumi Node backend, remote container, or ACP Agent process restarts.
- Persisting in-flight prompt execution, event streams, control leases, or Permission Requests to a database or filesystem.
- Introducing an HTTP API, polling protocol, message broker, durable queue, event-sourcing system, acknowledgement cursor, or token-level replay history.
- Adding user authentication, cross-user authorization, or multi-tenant session ownership within one remote container.
- Allowing multiple browser clients to write concurrently to the same Task Conversation.
- Automatically allowing or rejecting Permission Requests while no browser is attached.
- Keeping every idle ACP child process alive indefinitely.
- Changing ACP protocol names, Agent-provided Permission Decisions, Agent capabilities, or Agent-advertised Task Actions.
- Changing general IDE Layout, workspace switching, editor state, file-tree behavior, or unrelated Classic Chat behavior.
- Adding cross-container task migration, host-platform scheduling, or recovery of work after remote environment loss.
- Replacing existing Agent Task retention, archive, or session-list persistence policies.

## Further Notes

- Production evidence showed a deterministic sequence in which a working ACP Thread was disposed before its Agent process exited with `SIGTERM`; the connection-closed prompt error was a consequence of that disposal rather than an Agent crash or prompt timeout.
- Several independent ACP Threads were disposed within milliseconds of one another when a browser RPC service was torn down, demonstrating that the current failure can affect multiple sessions together.
- The design aligns with the existing decisions that Agent Tasks survive the browser lifecycle, one Agent Task owns one ACP session, pending Agent-provided Permission Decisions remain unresolved without a browser, and Task selection restores the ACP session without changing the IDE workspace.
- “Indefinite” execution means no browser keepalive or idle timeout applies while the ACP Thread is working. The guarantee ends with the Node/container process lifetime.
- The implementation should prefer the smallest lifecycle correction and attachment contract that satisfy the acceptance behavior. New infrastructure is justified only if the existing in-memory session state and RPC stream primitives cannot express the required behavior.
