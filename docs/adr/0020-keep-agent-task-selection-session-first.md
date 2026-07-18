---
status: accepted
---

# Keep Agent Task selection session-first

Agent Tasks remain bound to known Workspace Targets, but selecting a Task restores its ACP session without navigating the IDE to that target or reloading the page. Launching from a non-current Project Group likewise supplies that Project's path as the Agent working directory without changing the IDE workspace. This separates the persistent task execution context from the user's current file-tree and editor context, eliminating disruptive reloads while preserving full task interaction.

## Considered Options

- Switch the IDE workspace before task selection or task launch. Rejected because it reloads the page and interrupts the user's current editor context.
- Restore a foreign-workspace task as read-only. Rejected because the task must remain a usable ACP conversation, including prompts, permissions, and Agent actions.

## Consequences

The Agentic Chat View must display the selected Task's Workspace Target whenever it differs from the current IDE workspace. Overlapping task selections follow the latest-selection-wins rule, and a failed selection preserves the prior active session rather than opening a blank draft. IDE Layout, the file tree, and editor lifecycle remain unchanged; explicit workspace navigation is a separate future interaction.
