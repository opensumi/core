# Agentic Task List Usability Corrections

## Scope

This increment changes only the Agent Layout ACP Task List and its Agentic-only registry. It does not change IDE Layout, the shared workspace/editor/file-tree lifecycle, or `packages/ai-native/src/browser/layout/`.

## Resizable Task List

The Task List remains 244px by default and no smaller than 208px. Its maximum is no longer a fixed 280px: it is the smaller of 480px and the available ACP Chat Slot width after reserving 360px for the Main Conversation Area. The mouse drag and keyboard resize controls use the same bound. A `ResizeObserver` updates that bound when the Chat Slot changes size, so an old wide stored width is safely clamped in a narrower layout.

## Task creation affordance

Each Project Group exposes its contextual Task Launch as one icon-only `+` in the group header; the previous visible `New Task` label and separate Agent dropdown are not rendered. Clicking the `+` opens an Agent-bound draft with the resolved Project Agent Recall. The draft becomes a durable Task and receives a Task List row only after its first prompt is sent. The button retains an accessible name and tooltip that identify the target Project. The Task List header `+` remains the separate Project Addition action, so it never creates a Task.

The Agentic Chat View header uses the Main branch's `+` menu interaction: clicking the `+` opens an ACP Agent dropdown anchored to that control (hover does not open it), and selecting an Agent opens an Agent-bound draft. When a durable Task is selected, its bound Project is the target; otherwise the current IDE Workspace Target is used. That draft becomes a durable Task only when its first prompt is sent. This does not replace the Agent of the selected Task Conversation. The selection updates Project Agent Recall for the target Project only; it must not update the user-level default Agent. The menu retains the Main branch's `Agent Configuration` entry. Its check mark identifies the Agent resolved for the next Task: Project Agent Recall first, then the current Task Conversation's Agent, then the user-level default. When the ACP Agent Catalog is empty, the header `+` remains enabled and shows the configuration entry alone; a Project Group `+` is disabled with an explanation because it can only launch a Task.

## Session-first Task selection

Selecting a Task Row restores its ACP session without changing the IDE Workspace, file tree, editor state, or browser URL, regardless of the Task's bound Project. Project-group `+` likewise opens its Agent-bound draft directly with the group's path as the Agent working directory; it never prompts to save or discard IDE editors and never reloads the workbench. A foreign Project Task remains fully interactive. When its target differs from the current IDE Workspace, the Agentic Chat View header shows a persistent `Agent working directory` indicator with the Project label and full path hover text. It is context only, not a workspace switcher.

Concurrent selections use last-selection-wins semantics: only the latest selected Task may become active and clear its unread marker. If that latest ACP session cannot be restored, the existing conversation and Task List selection remain intact and no unbound draft is opened. Cross-project diff and file-navigation behavior is explicitly outside this increment.

## Project display names

The project record stores an optional user-supplied `label`. When no non-empty custom label exists, every Task List surface displays the last segment of the normalized `workspacePath` (or `/` for a filesystem root) as the project name. If available unnamed Projects have a matching last segment, each label includes the shortest parent-path suffix that distinguishes the set; this result is stable while searching and is recomputed only when project availability changes. This includes active groups, archived groups, the per-project New Task action, and the Agent working directory indicator. A custom label is rendered exactly as entered and may intentionally duplicate a default or custom label. Project identity remains the canonical workspace URI; renaming never affects tasks, stored ACP sessions, or ordering. Derived labels are presentation state and are never persisted.

Existing v2 records have only automatically derived labels, so they are treated as unnamed during normalization and display the new derived default label after migration.

## Rename interaction

Each active Project Group header has a clearly labelled edit action. It opens the standard OpenSumi `Modal` with a focused text input prefilled with the current custom label. For an unnamed Project, the input starts empty, uses the derived default label as a placeholder, and presents the complete cwd separately. Save trims whitespace and persists a non-empty custom label. Clearing the input removes the custom name and restores the derived default label. Cancel makes no change. Archived groups are read-only.

## Verification

Focused registry tests cover label migration, normalized custom labels, clearing a custom label, persistence, and unchanged project identity. Component tests cover the dynamic 480px/list-versus-conversation resize limit, default-label derivation, collision disambiguation, stable search labels, modal Save/Cancel/reset behavior, the foreign-Project context indicator, last-selection-wins behavior, and accessibility labels. ACP session tests prove a failed Task selection preserves the current conversation. Workspace-switch regression coverage proves Task activation and Project-group launch do not open a workspace, prompt for dirty editors, or schedule pending restoration. Runtime BDD coverage proves cross-project selection and launch retain the URL and current Workspace while restoring or starting the selected ACP session.
