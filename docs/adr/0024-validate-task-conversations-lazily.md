---
status: accepted
---

# Validate Task Conversations lazily

Agentic Layout renders the unified Agent Task List from its retained Task registry and validates an ACP session only when the developer selects that Task. It does not start every originating Agent across every Workspace Target during list loading, because eager reconciliation would make list availability depend on process startup, consume the bounded ACP Thread Pool, and turn transient Agent failures into misleading claims that Task history is gone.
