---
status: proposed
---

# Keep permanent Task deletion outside B-lite

B-lite will allow developers to archive and unarchive Agent Tasks from the persistent Agent Task List but will not expose permanent deletion of archived Tasks, Task Conversations, or Task Artifacts. Eventual deletion remains the host platform's retention-policy responsibility. This keeps the record durable and avoids a client-side destructive-data policy whose retention and compliance consequences belong to the host platform.
