# Agentic Layout Task Manager Design

## Goal

Make Agent Tasks continuously visible and actionable in the existing Agentic Layout while preserving the current editor and file tree workbench.

## Scope

This design applies only when the panel layout mode is `agentic` and ACP is available. Classic ACP Chat, IDE Layout lifecycle, Workspace implementation, shared workbench layout, and activity-bar behavior remain unchanged.

## Layout

The existing `AgenticShell` remains the root composition. Its ACP Chat Slot becomes an internal horizontal split; its existing Agentic Workbench remains untouched.

```text
Activity bar │ ACP Chat Slot                                 │ Agentic Workbench
             │ Agent Task List │ Main Conversation Area       │ Editor │ File tree
```

- **Agent Task List**: a persistent, resizable left subregion of the ACP Chat Slot. Default width is 244px; it may shrink no lower than 208px or grow beyond 280px.
- **Main Conversation Area**: the selected Task Conversation, with a minimum remaining width of 360px. It owns the task header, messages, ACP permission/input surfaces, artifacts, and composer.
- **Editor and file tree**: existing Agentic Workbench regions, with their current sizes, resize behavior, and commands. They are not reimplemented or moved.

At the existing Agentic Workbench collapse state, the ACP Chat Slot fills the work area; the Task List and Main Conversation Area retain their internal split. This feature does not introduce a new global sidebar, right status panel, Git panel, Goal panel, progress panel, or pinning.

## Agent Task List

The list header contains the title, an optional attention total, task-title search, and a New Task action. Each Project Group contains the project label, task count, and a New Task action preselected to that Project.

Active Project Groups are ordered by Catalog Joined At descending. Task Rows are ordered by creation time descending. Search filters only immutable Task Titles. Archived Tasks are in a collapsed Archived Area at the bottom, still grouped by Project. An Unavailable Workspace Target remains readable but disabled.

A Task Row contains an immutable title, primary ACP state text, and optional unread marker. A pending ACP Attention Signal takes precedence over ACP status in the state text. Archive and Unarchive actions replace the state text visually while revealed by hover or keyboard focus without shifting row layout. The list does not derive completion, add Stop or Retry controls, or show a pin action.

## Selection and launch

Selecting a Task for the current Workspace immediately activates its Task Conversation and clears its unread marker. Selecting a Task for a different Workspace performs a Workspace-aware Task Switch:

1. If any editor document is dirty, offer exactly Save All and Switch, Discard Changes and Switch, and Cancel.
2. Save All calls `saveAll(true)` and must recheck for remaining dirty documents; the switch stops if any remain.
3. Discard Changes only occurs after explicit confirmation.
4. The current browser page opens the Task's Workspace Target, reloads, and restores the same ACP session.

New Task begins from either list action. The developer selects a Known Workspace Target, then an ACP Agent. A target change follows the same guarded Workspace-aware Task Switch. The pending launch state contains only the target and Agent id; it never persists the initial prompt. Once the target workspace is active, the developer enters the first prompt in a fresh draft. That first line becomes the immutable Task Title, truncated to 100 characters.

## Data and authority

Each Agent Task has exactly one ACP session and one Workspace Target. ACP remains authoritative for task status, attention requests, permissions, and executable actions. The frontend persists only sanitized metadata: task/session id, project reference and label, Agent id, joined/created times, immutable title, unread/archive flags, and ACP status/attention summary. Prompt bodies, messages, permissions, commands, environments, credentials, and artifacts are never persisted in the Task List registry.

The Project Catalog is a separate Agentic-only record of validated Workspace Targets. It stores a project identifier, URI/path, label, Catalog Joined At, and current availability. Tasks reference `projectId`; they do not independently own project ordering or availability. MRU entries can be offered only after the catalog's authorization validation.

## Integration boundary

Agentic-only components and adapters may live in `packages/ai-native`. `AcpChatViewHeader` branches by Agentic mode: its Agentic branch substitutes the new persistent Agent Task List for the current inline ACP history surface, while Classic mode retains `AcpChatHistory` unchanged. `AgenticShell`, `WorkspaceService`, and IDE Layout files are consumption boundaries, not modification targets.

## Acceptance criteria

- Agentic desktop shows Task List, Main Conversation Area, editor, and file tree together.
- Classic ACP Chat keeps its existing history behavior.
- The Task List can select current- and cross-Workspace Tasks, launch a Task from its header or a Project Group, search titles, archive eligible Tasks, and display disabled unavailable Projects.
- A cross-Workspace selection follows the exact dirty-editor guard and restores the same ACP session after reload.
- Registry serialization excludes prompt/message/permission sentinels.
- No implementation file under `packages/ide-layout/`, `packages/main-layout/`, or `packages/ai-native/src/browser/layout/` changes.

## 2026-07-14 Project Catalog and Task Launch Amendment

This amendment supersedes the earlier Project-first launcher and MRU-catalog wording.

- The Agentic Chat header `+` launches directly for the current workspace; it never opens a Project picker. A Project Group's visible `+` launches directly for that group. Both use the recalled Agent for that Project, then the current conversation Agent, then the user default. A companion dropdown opens an ACP Agent selection modal when the developer needs to override that choice.
- The Task List header owns Project Management. Its folder-add action opens the existing directory picker, adds a directory without changing the editor or file tree, and makes a zero-task Project Group visible. A Project Group's overflow menu contains Rename and, only for a manual Project with no retained Tasks, Remove.
- The Project Catalog is local-user Agentic metadata. It contains manual Projects and Projects retained by Tasks; opening a workspace or appearing in MRU does not admit it. Existing v3 automatic catalog entries with no Task are removed during migration. Adding an existing path revalidates and focuses that Project instead of creating a duplicate.
- An unnamed Project displays the final segment of its normalized workspace path (or `/` for a filesystem root). If two available unnamed Projects have the same final segment, each displays the shortest parent-path suffix that distinguishes it from the other; these derived labels are stable while searching and automatically recompute only when the available Project set changes. A custom Project Name replaces that display text exactly, even when it duplicates another label. The complete cwd always remains available on hover and is never replaced in persisted Project data.
- Unavailable Projects and their Tasks remain persisted but are hidden from the default Task List and launch controls. They become visible again only after their workspace is available.
- Project Addition accepts one directory only. Multi-root `.code-workspace` files are outside this scope because an ACP Task has one cwd.
