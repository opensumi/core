# Agentic Layout

This context describes enhancements to OpenSumi's existing workspace-local Agentic Layout. Its desktop workbench combines an Agent Task List, an ACP Main Conversation Area, the editor, and the file tree; it is not a separate Agent-management application.

## Language

**ACP Agent**: An Agent implementation that communicates with OpenSumi through the Agent Client Protocol. Every Agent available in Agentic Layout must be an ACP Agent. _Avoid_: Agent provider, non-ACP backend

**ACP Agent Catalog**: The host-platform-managed list of validated ACP Agents available for Task Launch. Developers may select from the catalog but cannot add arbitrary ACP endpoints or server commands in B-lite. If no ACP Agent is available, Task Launch is unavailable while Project Management remains available. _Avoid_: Agent marketplace, custom provider list

**Agentic Layout**: The existing workspace-local OpenSumi layout mode that presents Agent Task List and ACP Main Conversation Area inside the ACP Chat Slot alongside the existing editor and file tree workbench. _Avoid_: Cross-workspace task center, separate agent application

**Agentic Layout Isolation**: The boundary that Agentic Layout changes must not alter IDE Layout lifecycle, Workspace behavior, or shared layout interactions. Agent-specific composition and behavior live within Agentic Layout; a shared component may be reused only when it is a stable, presentation-only primitive with no IDE Layout coupling. _Avoid_: IDE Layout modification, shared behavior regression, coupled layout component

**Agent Task List**: The persistent, resizable left subregion of the ACP Chat Slot in Agentic Layout. It manages Project Groups, groups Agent Tasks by Project, searches immutable Task Titles, and selects a Task through Session-first Task Selection; it is not a header popover or an IDE Layout sidebar. _Avoid_: Task history menu, persistent IDE sidebar, separate task center

**Task List Attention Indicator**: The attention state rendered on a non-active Task Row when its ACP Task Conversation has a pending ACP Attention Signal. It may be summarized in the Task List header, but is distinct from an unread marker. _Avoid_: Global application badge, unread count

**Agent Task**: A durable unit of Agent work bound to exactly one Workspace Target and containing exactly one Task Conversation. Selecting a Task restores its Task Conversation in Agentic Layout without changing the IDE's current Workspace; the bound Workspace Target remains visible as the Task's execution context. _Avoid_: Chat, conversation, background job

**Task Conversation**: The single ACP session through which the developer and Agent interact throughout an Agent Task. _Avoid_: Chat tab, subchat, conversation thread

**Durable Agent Task**: An Agent Task whose ACP session state and recoverable history outlive browser reloads, workspace navigation, temporary disconnection, and closure of the originating Web IDE page. _Avoid_: Persistent chat, detached process

**Shared Workspace Concurrency**: The execution model in which multiple Agent Tasks for the same Workspace Target run in separate ACP Threads while sharing the same backing directory. ACP Agents are responsible for coordinating their work; B-lite does not isolate, serialize, detect conflicts, or verify exclusive change attribution. _Avoid_: Parallel workspace, isolated task

**Project Group**: The Agent Task List section for one Known Workspace Target. A Project Group remains visible even when it contains no Agent Tasks so that its Project-group New Task action is available. Project Groups are ordered by Catalog Joined At with the newest Project first; inside each group, Tasks are ordered by creation time with the newest Task first. _Avoid_: Workspace section, task category

**Catalog Joined At**: The time a Known Workspace Target was added to the user's Workspace Catalog, used to keep Project Group ordering stable and place newly added projects first. _Avoid_: Directory creation time, last opened time

**Task Row**: The compact Agent Task List representation containing Task Title, primary ACP state text, and unread marker. A pending ACP Attention Signal replaces ACP Task Status in the state text. When an Archive or Unarchive action is revealed by hover or keyboard focus, the state text is visually hidden without changing row layout. _Avoid_: Task card, task summary

**Task Archive**: The user action available when ACP Task Status is `ready`, `stopped`, or `error` that removes an Agent Task from the active Agent Task List while preserving it for later discovery and restoration in Agentic Chat View. Tasks in `initializing`, `running`, or `stopping` cannot be archived. Archiving is the developer's explicit indication that no further task interaction is currently needed; B-lite does not permanently delete archived Tasks, Task Conversations, or Task Artifacts. _Avoid_: Delete task, complete task

**Task Retention**: The host-platform-managed policy that governs eventual storage and deletion of archived Agent Tasks, Task Conversations, and Task Artifacts. B-lite exposes archive and unarchive actions but no permanent deletion action. _Avoid_: Client-side deletion, archive expiration

**Archived Area**: The collapsed-by-default area at the bottom of the Agent Task List where archived tasks remain grouped by Project and can be unarchived. _Avoid_: Trash, completed section

**Workspace Target**: The project, workspace, worktree, or remote development environment in which an Agent Task operates. _Avoid_: Current workspace, repository

**Known Workspace Target**: A Workspace Target already authorized and made selectable in Agentic Layout. _Avoid_: Recent folder, arbitrary repository

**Unavailable Workspace Target**: A Workspace Target that is no longer authorized or currently reachable. Its Agent Tasks and history are retained but its Project Group is hidden from the default Agent Task List and its Task Launch is unavailable until access is restored. This availability condition is independent of ACP Task Status. _Avoid_: ACP stopped state, deleted project

**Workspace Catalog**: The user-scoped, local-profile collection of explicitly managed Platform Workspaces and Personal Projects available as Known Workspace Targets. It is not stored in a repository or workspace configuration. The currently open Workspace Target is usable for a Header Task Launch but is not admitted solely by being opened; recent workspaces are not automatically admitted, while targets bound to retained Agent Tasks remain represented. _Avoid_: Recent workspace list, repository browser

**Platform Workspace**: A Known Workspace Target supplied and authorized by the Web IDE host platform. _Avoid_: Built-in project, shared folder

**Personal Project**: A user-created Known Workspace Target backed by a directory in platform-authorized storage and assigned a user-facing project name. _Avoid_: Custom workspace, arbitrary path

**Project Name**: A mutable user-facing label for a Project Group that is independent of the backing directory name and path. Clearing a Project Name returns the Project to its default label. When no Project Name is set, the Project displays the final directory segment of its normalized workspace path; the path's root directory displays `/`. If default names collide among all currently available Projects, the minimum parent-directory prefix needed to distinguish them is displayed; search filtering does not change these labels. These derived labels automatically recompute when the available Project set changes and are never persisted. A custom Project Name always displays exactly as entered, even if it matches another visible label; automatic disambiguation applies only between default names. For an unnamed Project, the Project Name input starts empty with the default label as its placeholder, while the full workspace path is presented separately. The full workspace path remains available on hover both before and after renaming. _Avoid_: Folder name, workspace path

**Task Launch**: The Agentic Layout flow that first opens a Task Draft and creates a Durable Agent Task when its first prompt is sent. Launching from the Agentic Chat View header uses the selected Task's Workspace Target when a Task Conversation is active, otherwise it uses the current IDE Workspace Target; launching from a Project Group uses that group's Workspace Target directly. The selected Workspace Target provides the Agent's working directory without changing the IDE's current Workspace. Its primary fields are task description and ACP Agent; model, permission mode, and other optional parameters are advanced settings. A failed Task Launch preserves the previous Active Task and its unsent draft rather than entering an unbound draft. _Avoid_: Unbound new chat, projectless task

**Task Draft**: The Agent-bound composition state opened by Task Launch before an ACP session or Durable Agent Task exists. Its first Prompt creates the Task Conversation and makes the Agent Task durable. _Avoid_: New Session, empty Task

**Project Management**: The Agent Task List capability for adding and maintaining Known Workspace Targets. Project selection is not part of ordinary New Task creation when its Workspace Target is already implied by the launch entry point. _Avoid_: New Task project picker, recent-workspace list

**Project Addition**: The Project Management action that authorizes a developer-selected directory as a Known Workspace Target. It does not switch the IDE Workspace. Adding a directory that already identifies a Known Workspace Target reuses and revalidates that Project rather than creating a duplicate. A newly added project initially displays its derived default Project Name and may be renamed afterwards. Multi-root workspace files are not Project Addition targets because an ACP Agent Task has one working directory. _Avoid_: Recent-workspace import, New Task project selection

**Project Removal**: The Project Management action that removes a manually added Project Group with no active or archived Agent Tasks. A Known Workspace Target that owns retained Agent Tasks cannot be removed, preserving the task history's project association. _Avoid_: Task deletion, task orphaning

**Project Management Menu**: The overflow menu on a Project Group that contains its Rename and, when allowed, Project Removal actions. It is separate from the group's visible Project-group New Task action. _Avoid_: New Task menu, task actions

**Project-group New Task**: The single icon-only `+` action on a Project Group that opens a Task Draft in that group's Workspace Target with its resolved Project Agent Recall. The Task becomes durable only after its first prompt. It uses the group's path as the Agent working directory without changing the IDE's current Workspace, and never asks the developer to choose a different project. _Avoid_: Project switcher, add project

**Open Agentic Layout**: The existing layout-switch action, sometimes described as “Open in Agents”, that activates the `agentic` layout for the current Workspace Target. It does not register, duplicate, move, or otherwise change an ACP session. _Avoid_: Session import, Task registration, cross-workspace navigation

**Task Title**: The immutable short label rendered as the primary text in an Agent Task Row and in the Agentic Chat View header. In B-lite, it is derived from the first line of the Task Launch description and truncated for display; it is not a separate launch field, cannot be renamed, and is not ACP-provided. _Avoid_: Session title, Agent-generated title, task summary

**Project Task Defaults**: The ACP Agent, model, permission mode, and optional launch settings explicitly saved for one Known Workspace Target, with user-level defaults as fallback. A one-off Task Launch override does not change these defaults unless the developer explicitly saves it. _Avoid_: Last-used configuration, workspace settings

**Project Agent Recall**: The ACP Agent most recently selected for Task Launch in a Project Group. A direct New Task action resolves its Agent from Project Agent Recall first, then the current Task Conversation's ACP Agent, then the user-level default. The Chat header's primary New Task action launches directly with this resolution; choosing an Agent from its separate Agent-choice action launches immediately, updates the Project Agent Recall, and does not change the user-level default. _Avoid_: Project Task Defaults, globally last-used Agent

**ACP Task Status**: The task status rendered from ACP session and thread data: `initializing`, `ready`, `running`, `stopping`, `stopped`, or `error`. Agentic Layout does not infer a `completed` status; `ready` means the ACP Agent is waiting for another prompt. _Avoid_: Frontend task state, completion status

**ACP Task Action**: An action explicitly made available by ACP for a Task Conversation. Agentic Layout renders and forwards only these advertised actions; it does not add its own stop, retry, or lifecycle controls. _Avoid_: Frontend retry, synthetic task action

**ACP Attention Signal**: A structured ACP-originated request that requires developer action, such as a Permission Request or an Agent-provided input request. Agentic Layout renders pending signals and does not infer them from conversation content. _Avoid_: Attention state, notification

**Permission Request**: An Agent-originated request for a user decision before a protected operation proceeds. The Agent supplies the available decisions, while OpenSumi routes the request, applies existing rules, and prevents the Agent from granting itself permission. _Avoid_: Permission prompt, Agent approval

**Permission Decision**: The selected Agent-provided outcome such as allow once, allow always, reject once, or reject always, made by the developer or resolved by an existing OpenSumi permission rule. _Avoid_: Permission policy, tool result

**Task List Metadata**: The independent `unread` and `archived` markers used to organize an Agent Task in the Agent Task List without representing ACP Task Status or ACP Attention Signals. _Avoid_: ACP status, permission state, pin state

**Unread Task**: An Agent Task that received new Agent content, a Permission Request, or another structured ACP input request while its Agentic Chat View was not selected. Selecting that Task clears the unread marker; ordinary ACP status changes do not create it. _Avoid_: Pending task, attention task

**In-layout Task Notification**: The B-lite notification model in which new ACP output and pending ACP Attention Signals are communicated only through Agent Task List unread markers and Task List Attention Indicators, without browser or host-platform push notifications. _Avoid_: Web push, system notification

**Agentic Chat View**: The primary conversational content area in Agentic Layout, positioned to the right of the Agent Task List inside the ACP Chat Slot. It restores and continues the selected Task Conversation; selecting a Task replaces the view's conversation, pending permission or input requests, and review artifacts with those of that Task without changing the IDE workspace. It renders ACP Task Actions and shows file diffs plus test or command summaries alongside the current IDE file tree and editor, even when the selected Task's Workspace Target differs. In that case, its header renders an Agent Execution Context Indicator. _Avoid_: Separate Task Review application, chat replay

**Session-first Task Selection**: The Task List interaction that restores the selected Task Conversation, including its Agent, pending interactions, and task artifacts, while leaving the IDE's current Workspace, file tree, and editor state unchanged. A Task may remain fully interactive when its bound Workspace Target differs from the IDE's current Workspace; the Agentic Chat View must make that target visible as execution context. When selections overlap, only the latest selection may become active or clear a Task's unread marker. A failed selection preserves the previously active Task Conversation, Task Row, and unread state rather than opening an unbound draft. _Avoid_: Workspace-aware Task Switch, workspace navigation, read-only task replay

**Agent Execution Context Indicator**: The persistent Agentic Chat View header label shown only when the selected Task's Workspace Target differs from the current IDE Workspace. It presents the target's project label and exposes its complete path on hover, but does not navigate, change the IDE workspace, or alter the file tree and editor. _Avoid_: Workspace switcher, project picker, navigation breadcrumb

**Task Artifact**: Server-retained supplemental data produced by an Agent Task, including file diffs and test or command summaries, that Agentic Chat View can present alongside the activated Workspace Target. _Avoid_: Workspace snapshot, task log

**Read-only Task Diff**: The Task Artifact view of file changes that supports inspection only and does not independently verify exclusive authorship under Shared Workspace Concurrency. Editing, inline feedback, accepting, rejecting, and reverting changes are outside B-lite and require conversation follow-up or direct editing in the activated Workspace. _Avoid_: Review editor, change approval

**Workspace-aware Task Switch**: The explicit transition that opens a different Workspace Target in the IDE. It is not part of Session-first Task Selection. If used by a future explicit navigation action, it reuses the current browser page, opens the target Workspace path, and reloads the IDE; when the current Workspace has unsaved edits, the developer must choose to save all, discard changes, or cancel. It never creates a new ACP session. _Avoid_: Task selection, chat-only switch, new browser window, Workspace Handoff
