---
status: proposed
---

# Isolate Agentic Layout changes from IDE Layout

Agent-management features will be implemented within Agentic Layout and must not change IDE Layout lifecycle, Workspace behavior, or shared layout interactions. Agent-specific components and adapters should remain local to Agentic Layout; existing components may be reused only when they are stable, presentation-only primitives without IDE Layout coupling. This prevents the new Task workflow from regressing the default IDE while avoiding copy-and-paste of safely shareable leaf UI.
