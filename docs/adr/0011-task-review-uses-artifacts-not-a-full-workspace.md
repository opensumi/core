---
status: superseded by ADR-0017
---

# Task Review uses artifacts instead of a full workspace

Task Review will present and continue the Task Conversation, handle pending permission or input requests, support stopping or retrying the task, and show file diffs plus test or command summaries from server-retained Task Artifacts. Follow-up messages continue the same ACP session and may update the artifacts. File diffs are read-only in B-lite: editing, inline feedback, accepting, rejecting, and reverting are excluded. Task Review will not load a complete workspace file tree, editor, interactive terminal, debugger, or extension runtime. Work that requires those surfaces uses explicit Workspace Handoff. This preserves fast cross-project review while keeping the initial implementation small.
