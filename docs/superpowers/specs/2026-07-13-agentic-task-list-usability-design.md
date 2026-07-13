# Agentic Task List Usability Corrections

## Scope

This increment changes only the Agent Layout ACP Task List and its Agentic-only registry. It does not change IDE Layout, the shared workspace/editor/file-tree lifecycle, or `packages/ai-native/src/browser/layout/`.

## Resizable Task List

The Task List remains 244px by default and no smaller than 208px. Its maximum is no longer a fixed 280px: it is the smaller of 480px and the available ACP Chat Slot width after reserving 360px for the Main Conversation Area. The mouse drag and keyboard resize controls use the same bound. A `ResizeObserver` updates that bound when the Chat Slot changes size, so an old wide stored width is safely clamped in a narrower layout.

## Project display names

The project record stores an optional user-supplied `label`. When no non-empty custom label exists, every Task List surface displays `workspacePath` as the project name. This includes active groups, archived groups, the per-project New Task action, and the Project-first launcher. Project identity remains the canonical workspace URI; renaming never affects tasks, stored ACP sessions, workspace switching, or ordering.

Existing v2 records have only automatically derived labels, so they are treated as unnamed during normalization and display their workspace paths after migration.

## Rename interaction

Each active Project Group header has a clearly labelled edit action. It opens the standard OpenSumi `Modal` with a focused text input prefilled with the current custom label (or empty for the path fallback). Save trims whitespace and persists a non-empty custom label. Clearing the input removes the custom name and restores the workspace-path fallback. Cancel makes no change. Archived groups are read-only.

## Verification

Focused registry tests cover label migration, normalized custom labels, clearing a custom label, persistence, and unchanged project identity. Component tests cover the dynamic 480px/list-versus-conversation resize limit, path fallback across all visible project surfaces, modal Save/Cancel/reset behavior, and accessibility labels. Existing ACP task-list and workspace-switch regression suites remain required.
