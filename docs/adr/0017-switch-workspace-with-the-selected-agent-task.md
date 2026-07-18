---
status: superseded by ADR-0020
---

# Switch Workspace with the selected Agent Task

Each Agent Task is bound to one Workspace Target and its ACP session. When the developer activates a Task for a different target, B-lite will reuse the current browser page, switch the IDE to that target path, reload the Workspace, and restore the same ACP session in Agentic Layout. When the current Workspace contains unsaved edits, the developer must save all, discard changes, or cancel before switching. It will not open a new browser window or switch only the chat while leaving the file tree and editor on another project's path.
