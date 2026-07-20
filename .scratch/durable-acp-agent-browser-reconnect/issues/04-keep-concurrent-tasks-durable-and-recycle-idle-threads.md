# Keep concurrent Agent Tasks durable while recycling idle threads

Status: ready-for-agent

## Parent

[Durable ACP Agent Execution Across Web IDE Reloads](../PRD.md)

## What to build

Deliver the multi-session and resource-management path for user stories 4, 13–15, 27–30, and 38.

Multiple Agent Tasks in the same remote container must continue independently when a browser connection disconnects. Reloading the Web IDE automatically attaches only the last viewed Task Conversation; other Task Conversations remain visible with authoritative ACP Task Status and attach on demand when selected.

Protect every running ACP Thread from timeout and LRU recycling so long tasks have no browser keepalive limit. Preserve existing capacity management for idle and awaiting-prompt threads: they may be recycled when the pool requires capacity, while their ACP sessions and Agent Tasks remain loadable later.

Use the existing session snapshot and update identities to merge any small duplicate window around attachment. Do not add a durable event journal, acknowledgement cursor, or token-level replay system.

## Acceptance criteria

- [ ] Two or more concurrent Agent Tasks continue running when one browser RPC connection is disposed.
- [ ] Disconnecting or replacing one browser client does not terminate running or idle sessions owned by the container-scoped ACP Agent service.
- [ ] Web IDE reload automatically attaches the last viewed Task Conversation and does not open full output streams for every background task.
- [ ] Other Agent Tasks remain discoverable with authoritative ACP Task Status and attach when the developer selects them.
- [ ] Selecting another running Task Conversation restores its current snapshot and subsequent live output without creating or repeating a prompt.
- [ ] ACP Threads in `working` state are never selected for timeout or LRU recycling, regardless of how long their prompt has been running or whether a browser is attached.
- [ ] ACP Threads in `idle` or `awaiting_prompt` state remain eligible for existing pool recycling when capacity is required.
- [ ] Recycling an idle process does not delete its ACP session or Agent Task, and selecting it later can load the same Task Conversation into an eligible thread.
- [ ] Snapshot/live-boundary duplicates are merged using existing message, tool-call, and session identities without adding persistent event sequencing infrastructure.
- [ ] Focused multi-session and pool tests cover concurrent disconnect behavior, running-thread pinning, idle-thread recycling, and later session restoration.

## Blocked by

- [01 — Preserve one running Task Conversation across Web IDE reload](./01-preserve-running-task-conversation-across-reload.md)
