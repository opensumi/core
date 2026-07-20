# Agentic Layout Persistent Task List Workbench

Status: ready-for-agent

## 2026-07-14 Approved launch and Project-management update

The Project picker is removed from ordinary New Task creation. The Agentic Chat header creates a task in the current workspace, and a Project Group creates a task in that group; each `+` directly uses the Project's last selected ACP Agent, falling back to the current conversation Agent and then the user default. The adjacent dropdown is the explicit Agent override.

Project Management moves to the Task List: a header folder-add action selects one directory and creates an empty Project Group without navigating the IDE; Project Group overflow actions rename and conditionally remove a manual, task-free Project. The catalog is local-user Agentic metadata, not MRU. It keeps explicit Projects and task-owned history only, hides unavailable Projects by default, and never writes into repository or workspace configuration.

## Problem Statement

Developers using Agentic Layout need to manage several ongoing ACP Agent Tasks while they inspect and edit the project each task targets. The existing ACP session history is oriented around individual sessions: it does not provide durable Project grouping, task-level attention and unread state, a safe way to restore a task for another Workspace Target, or a Project-first task-launch flow. It also leaves the relationship between the active Task Conversation and the editor/file tree unclear.

## Solution

Extend the existing Agentic Layout rather than introduce a separate task application. The desktop workbench shows four coordinated regions: an Agent Task List, the Main Conversation Area, the existing editor, and the existing file tree. The Agent Task List is a persistent, resizable left subregion of the ACP Chat Slot. It groups durable Agent Tasks by Project, lets developers select or launch a Task, and renders ACP-owned status and attention information.

Selecting a Task for another Workspace Target reuses the current browser page, protects dirty editor documents, opens that Workspace Target, and restores the same Task Conversation after reload. The feature is isolated to Agentic Layout and ACP behavior; it does not alter IDE Layout, the existing workbench, editor, or file-tree lifecycle.

## User Stories

1. As a developer, I want to see an Agent Task List beside my active Task Conversation, so that I can manage work without leaving Agentic Layout.
2. As a developer, I want the existing editor and file tree to remain visible beside the Task List and conversation, so that I can relate Agent work to the project files it affects.
3. As a developer, I want the Task List to stay visible when the Agentic Workbench is collapsed, so that task navigation and conversation remain usable in the expanded ACP Chat Slot.
4. As a developer, I want Task Rows grouped by Project, so that I can distinguish work targeting different Workspace Targets.
5. As a developer, I want Project Groups ordered by when they joined my Workspace Catalog and Tasks ordered by creation time, so that recent work is predictably easy to find.
6. As a developer, I want each Project Group to show its task count and offer a New Task action already targeted at that Project, so that I can act from the relevant context.
7. As a developer, I want to search immutable Task Titles only, so that I can find a Task without widening client-side retention of conversation content.
8. As a developer, I want a Task Row to show its immutable title, relative creation time, one primary ACP state icon, and an independent unread marker, so that I can scan the list efficiently.
9. As a developer, I want a pending ACP Attention Signal to take precedence over the normal status icon, so that permission and structured-input decisions are immediately visible.
10. As a developer, I want unread state to remain independent of ACP status and attention, so that I can distinguish unseen Agent output from a decision that requires action.
11. As a developer, I want an in-layout attention total when applicable, so that I can notice tasks needing a response without browser or host notifications.
12. As a developer, I want selecting a Task for the current Project to restore its Task Conversation immediately and clear its unread marker, so that I can resume work without reloading the IDE.
13. As a developer, I want selecting a Task for another Project to switch the current page to that Project and restore the same ACP session, so that the file tree, editor, and Agent work always refer to the same Workspace Target.
14. As a developer with dirty editor documents, I want exactly Save All and Switch, Discard Changes and Switch, or Cancel before a cross-Project Task switch, so that I retain control of local changes.
15. As a developer, I want Save All and Switch to stop when any document remains dirty after saving, so that an unsuccessful save cannot silently bypass my edits.
16. As a developer, I want a discarded-change switch to require my explicit choice, so that no local changes are closed implicitly.
17. As a developer, I want to start a New Task from the Task List header, so that the primary launch action is always available.
18. As a developer, I want to choose a Known Workspace Target before choosing an ACP Agent, so that a new Task starts in the intended Project.
19. As a developer, I want a target change during New Task creation to use the same dirty-editor guard as a cross-Project Task switch, so that task launch is equally safe.
20. As a developer, I want a one-off ACP Agent selection to leave my default Agent preference unchanged, so that a task-specific choice does not change future defaults.
21. As a developer, I want the first line of my first accepted prompt to become the immutable Task Title, up to 100 characters, so that discovery uses a compact, stable, non-Agent-generated label.
22. As a developer, I want a fresh Task Conversation to remain free of a title until I submit its first accepted prompt, so that no initial prompt text is persisted before the Task exists.
23. As a developer, I want eligible ready, stopped, or error Tasks to be archived and later unarchived, so that the active list stays focused without permanently deleting work.
24. As a developer, I want archived Tasks in a collapsed Archived Area at the bottom of the list, still grouped by Project, so that retained work is available without dominating active work.
25. As a developer, I want unavailable Workspace Targets to remain readable but disabled, so that I can recognize retained history without starting an unsafe activation.
26. As a developer, I want all selectable Project targets to be validated Known Workspace Targets, so that task launch cannot accept arbitrary filesystem text or unapproved destinations.
27. As a developer, I want Project Catalog and Task Registry storage to exclude prompt bodies, messages, permissions, commands, environments, credentials, and artifacts, so that task discovery does not expand client-side sensitive-data retention.
28. As a developer, I want Task Artifacts and diffs to remain read-only in the Task Conversation while I use the existing workspace editor for changes, so that task history does not become a second editing surface.
29. As a developer, I want ACP to remain authoritative for task status, attention, permission choices, input requests, and advertised actions, so that the UI does not invent lifecycle behavior.
30. As a developer, I want the Task List width to be adjustable inside Agentic Layout within usable bounds, so that I can balance task discovery against conversation reading.
31. As a developer, I want Classic ACP Chat to keep its current session-history behavior, so that Agentic task management does not regress the classic workflow.
32. As a developer, I want existing Agentic maximize behavior to remain available while the old Agentic New Session menu is removed, so that launching follows the Project-first Task List flow without losing panel control.
33. As a developer, I want ordinary IDE Layout and its workspace/editor/file-tree behavior to remain unchanged, so that adopting Agentic Task management has no unrelated layout regressions.

## Implementation Decisions

- Agentic Layout is the only product surface for this feature. The accepted composition puts the persistent Agent Task List inside the existing ACP Chat Slot, with the Main Conversation Area beside it; the existing Agentic Workbench continues to own the editor and file tree.
- The Task List default width is 244px, with a 208px minimum and 280px maximum. This keeps at least 360px for the Main Conversation Area within the existing ACP Chat Slot minimum width. The width is local Agentic presentation state, not an IDE Layout change.
- Agentic-only UI replaces the Agentic inline ACP history surface. Classic ACP retains the existing history component and behavior unchanged. The Agentic panel retains its maximize action but no longer renders the Agentic default-Agent New Session menu.
- A durable Agent Task has exactly one ACP session and one Project Catalog reference. A Project record owns the canonical validated Workspace Target URI/path, label, Catalog Joined At time, and availability. Task records reference `projectId` rather than duplicating Project ordering or availability.
- The Project Catalog is user-scoped and Agentic-only. It seeds from the active Workspace and may offer host-provided recently used Workspaces only after availability/authorization validation; it never accepts arbitrary local path text, repository cloning, or custom ACP endpoints.
- The Task Registry persists only sanitized task discovery metadata: task/session identity, Project reference, ACP Agent identity, catalog and creation times, immutable Task Title, unread/archive flags, and ACP status/attention summaries. Reload-only pending activation and pending launch state are separate and contain no prompt content.
- Every Agent available in Agentic Layout is an ACP Agent. ACP is authoritative for the `initializing`, `ready`, `running`, `stopping`, `stopped`, and `error` task states, pending Attention Signals, permission and input requests, and executable actions. The frontend does not infer completion or introduce Stop, Retry, or pin actions.
- A target-aware ACP configuration accepts an explicit ACP Agent id and working directory for one-off Task creation and restoration. The existing default ACP configuration remains unchanged for Classic and non-Task flows.
- Selecting a Task in the current Workspace activates the stored session and clears unread state. Selecting a valid Task in a different Workspace uses a Workspace-aware Task Switch: it guards dirty editor documents, records the pending activation, opens the target on the current page, and restores that same session after reload. Pending activation restoration takes priority over a pending Task launch.
- The dirty-editor guard offers exactly Save All and Switch, Discard Changes and Switch, and Cancel. Save All must recheck for dirty documents after saving; Discard Changes occurs only after the explicit choice. The Agentic adapter owns this flow and consumes existing Workspace/editor APIs without changing their contracts.
- New Task starts from the Task List header or a Project Group. It selects Project first, then ACP Agent. If the selected Project differs from the active Workspace, the launcher stores only the Project and Agent identity, performs the guarded switch, and enters a fresh Agentic draft after reload. The first accepted prompt's first line becomes the immutable 100-character maximum Task Title.
- Active Project Groups sort by Catalog Joined At descending; Task Rows sort by creation time descending. Search compares only immutable Task Titles. Archived Tasks move to a collapsed-by-default Archived Area, still grouped by Project. Archive is enabled only for `ready`, `stopped`, and `error` Tasks; permanent deletion is not provided.
- A Task Row renders exactly one primary state icon. Pending ACP Attention Signal takes precedence over status; unread is separate. Unavailable Project Groups remain visible and disabled. In-layout Task List indicators are the only new notification model.
- Task Artifacts are read-only Task Conversation data. Direct editing remains in the activated Workspace editor; accepting, rejecting, reverting, or attributing a diff is not part of this feature.

## Testing Decisions

- The primary acceptance seam is the existing Agentic ACP BDD/Playwright flow. In a running IDE, it verifies the four visible regions, Task List behavior, ACP session identity, Workspace-aware switching, reload restoration, and the unchanged Agentic Workbench.
- The BDD/Playwright flow covers title search, Project/Task ordering, current-Project activation without a reload, cross-Project Save All, Discard, and Cancel outcomes, archive/unarchive eligibility, attention rendering, Project-first cross-Project launch, and the absence of sensitive persistence sentinels.
- Focused unit tests protect the Project Catalog and Task Registry contracts, including sorting, immutable-title search, archive eligibility, unavailable target state, sanitized serialization, and pending activation/launch restoration priority. Tests assert observable behavior and stored-data boundaries rather than component internals.
- Focused ACP tests protect explicit Agent/working-directory configuration for target-aware session creation and restoration while proving the default configuration for Classic paths is unchanged.
- Focused switch tests protect dirty-document detection, post-save recheck, explicit discard behavior, current-page Workspace opening, same-session restoration, and availability checks.
- Component tests protect attention-over-status precedence, independent unread state, the collapsed Archived Area, Project-first launcher order, one-off Agent preference isolation, disabled unavailable Project rows, and Task List resize bounds/accessibility.
- Regression tests protect Classic ACP history, Agentic maximize behavior, removal of only the Agentic default-Agent New Session menu, and the absence of changes to the IDE Layout composition boundary.
- Persistence tests use unique prompt, assistant, thought, tool-result, and permission-content sentinels and assert none occurs in Task Registry or pending-work serialization.
- Existing Agentic ACP history and rich-session restore Playwright coverage are the prior art for runtime tests. Existing ACP configuration, chat manager, internal service, history, header, wrapper, permission bridge, and ACP Agent service tests are the prior art for focused tests.

## Out of Scope

- Modifying IDE Layout lifecycle, the Agentic Shell, WorkspaceService, shared workbench composition, activity-bar behavior, editor behavior, file-tree behavior, or their commands.
- A separate task-center application, persistent IDE-wide task sidebar, header-popover-only task-management model, or a new global/right status panel.
- Permanent Task deletion, Task pinning, synthetic Stop/Retry controls, frontend completion inference, Agent-generated or editable Task Titles, and host/browser notifications.
- Git tooling, commit actions, branch switching, Goal or Progress panels, task checklists, custom task actions, or an Agent marketplace.
- Arbitrary filesystem paths, repository cloning, custom ACP endpoint/server configuration, or unchecked recent-workspace entries.
- Editing, inline feedback, accepting, rejecting, reverting, or exclusive-attribution verification for Task Artifact diffs.
- Isolating, serializing, or conflict-detecting simultaneous ACP Tasks that share the same Workspace Target.

## Further Notes

- The accepted layout composition is recorded in ADR 0019. The domain glossary defines Agent Task List, Project Group, Task Row, Task Conversation, Workspace-aware Task Switch, and ACP Attention Signal.
- The validated visual reference is `docs/superpowers/designs/2026-07-12-agentic-layout-task-manager-v2.html`; it is a design preview, not implementation code.
- The former header-popover approach is superseded. The active technical plan is the Agentic Task List Workbench plan supplied with this PRD update.
