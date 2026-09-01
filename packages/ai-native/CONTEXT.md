# Agentic Layout

This context describes OpenSumi's workspace-local Agentic Layout. Its desktop workbench combines an Agent Session Browser, an ACP Main Conversation Area, the editor, and the file tree; it is not a separate Agent-management application.

## Language

**ACP Agent**: An Agent implementation that communicates with OpenSumi through the Agent Client Protocol. Every Agent available in Agentic Layout must be an ACP Agent. _Avoid_: Agent provider, non-ACP backend

**Standby ACP Process**: An initialized ACP Agent process that is not bound to an Agent Session and is available for a compatible Session Launch or Agent Session restoration. Maintaining standby capacity is best-effort under finite resource limits and does not guarantee that every ACP configuration can avoid process cold start. _Avoid_: Guaranteed warm session, pre-created Session, unlimited warm pool

**ACP Standby Target**: The exact ACP runtime configuration selected by the current or last confirmed Session Launch context for which Agentic Layout attempts to maintain Standby ACP Process capacity throughout the IDE page lifecycle. Project Addition and historical Session Selection do not change it; changing the Session Draft's selected ACP Agent or Workspace Target replaces it, so an unbound standby or in-flight warmup for a superseded target may be reclaimed without affecting active Agent Sessions. _Avoid_: Global warm pool, any idle Agent process, per-Agent-only target

**ACP Agent Identity**: The stable, non-reusable `agentId` that owns an ACP Agent's Session namespace across compatible Agent upgrades. A materially incompatible Agent implementation receives a new identity or migrates its existing Sessions. _Avoid_: Agent command name, current Agent selection, process configuration fingerprint

**Agent Session Identity**: The raw ACP `sessionId` is assumed unique across configured ACP Agents for Agentic Layout routing. If Agent discovery violates that assumption, every colliding result is excluded for that refresh rather than being assigned to an arbitrary Agent. _Avoid_: Agent-local session key, guessed route

**ACP Agent Catalog**: The host-platform-managed list of validated ACP Agents available for Session Launch and discovery. Catalog entries use stable ACP Agent Identities that must not be reassigned to incompatible Agent implementations. Developers may select from the catalog but cannot add arbitrary ACP endpoints or server commands in B-lite. If no ACP Agent is available, Session Launch is unavailable while Project Management remains available. _Avoid_: Agent marketplace, custom provider list

**Agentic Layout**: The existing workspace-local OpenSumi layout mode that presents the Agent Session Browser and ACP Main Conversation Area inside the ACP Chat Slot alongside the existing editor and file tree workbench. _Avoid_: Cross-workspace task center, separate agent application

**Agent Session Browser**: The persistent, resizable left subregion of Agentic Layout. It presents only ACP Sessions returned by configured Agents through `session/list` for currently available Known Workspace Targets. It groups Sessions in Workspace Catalog order and orders each group by Agent-provided `updatedAt`; missing titles use a generic unnamed-session label. A refresh atomically replaces the browser snapshot but does not invalidate an already loaded active Session when that Session is omitted or its Agent query fails. `session_info_update` may refresh metadata for a listed Session but does not independently add one; updates received during a refresh remain authoritative over the replacing discovery snapshot. Overlapping Session loads are latest-intent only: a superseded replay never changes the active Session. _Avoid_: Local task history, cached fallback list, prompt-derived title, synthetic current-session row

**Agent Session Authority**: The originating ACP Agent is authoritative for Session existence, Session metadata, and durable conversation content. OpenSumi discovers metadata through `session/list` and reconstructs content from `session/load` updates and result. While an ACP Thread remains active, it also retains each client-submitted User Prompt as a replay-shaped `user_message_chunk` so a page reload does not lose that turn when the Agent omits the user echo; a matching Agent echo is suppressed as a duplicate. This page-lifecycle retention is not durable history and cannot restore a Prompt after the backing Thread is released. Local Durable Task metadata must not create, rename, restore, or otherwise substitute for an Agent Session. _Avoid_: Local transcript authority, Task-registry fallback, inferred history

**Agent Session Discovery Refresh**: A serial traversal of every available ACP Agent across every available Known Workspace Target. If any target query fails for an Agent, all results from that Agent are discarded for that refresh. Failures are silent in the UI and produce only bounded diagnostics. Refresh occurs on Agentic Layout entry, after a newly created Session accepts its first prompt, and on relevant catalog lifecycle changes; it is not manually triggered or polled. _Avoid_: Background polling, partial Agent snapshot, stale fallback

**Agentic Layout Isolation**: The boundary that Agentic Layout changes must not alter IDE Layout lifecycle, Workspace behavior, or shared layout interactions. Agent-specific composition and behavior live within Agentic Layout; a shared component may be reused only when it is a stable, presentation-only primitive with no IDE Layout coupling. _Avoid_: IDE Layout modification, shared behavior regression, coupled layout component

**Legacy Durable Task Metadata**: Previously persisted Task, archived, unread, attention, status, pending activation, and remembered-active records. These records remain stored for compatibility but Agentic Layout no longer reads or writes them for Session discovery, selection, restoration, notification, or project-removal decisions. The separate Agent Session Archive Marker is not legacy Task metadata. _Avoid_: Session source, migration input, fallback history

**Agent Session Archive Marker**: A local, user-profile-scoped presentation preference keyed by the Agent Session's `{agentId, cwd, sessionId}` route. It moves an Agent-returned Session between the active and archived sections of the Agent Session Browser without closing, deleting, renaming, or otherwise mutating the Agent-owned Session. An archive marker is displayed only while the matching Session remains present in the current Agent discovery snapshot. _Avoid_: Agent archive state, Session deletion, Durable Task record

**Unavailable Agent Session**: A page-local condition observed when the originating Agent cannot complete `session/load` for a selected Session. The previous active Session remains visible, the failed row is marked unavailable for the current page lifecycle, and selecting the row again retries the same raw `sessionId`. _Avoid_: Deleted local Task, permanent failure metadata, draft fallback

**Agent Session**: The ACP conversation through which the developer and Agent interact. Its existence, metadata, retained transcript, and durability are owned by the Agent; OpenSumi keeps page-local presentation state and the target route needed to load or continue it. _Avoid_: Local Task record, chat tab, detached process

**Shared Workspace Concurrency**: The execution model in which multiple Agent Sessions for the same Workspace Target run in separate ACP Threads while sharing the same backing directory. ACP Agents are responsible for coordinating their work; Agentic Layout does not isolate, serialize, detect conflicts, or verify exclusive change attribution. _Avoid_: Parallel workspace, isolated task

**Project Group**: The Agent Session Browser section for one available Known Workspace Target. It remains visible when it contains no Sessions so its New Session action and project management remain available. Project Groups follow Workspace Catalog order; Sessions inside a group are ordered by Agent-provided `updatedAt` descending. _Avoid_: Task category, Agent-owned project catalog

**Catalog Joined At**: The time a Known Workspace Target was added to the user's Workspace Catalog and part of its stable catalog order. _Avoid_: Directory creation time, last opened time

**Session Row**: The compact Agent Session Browser representation containing the Agent-provided title, originating ACP Agent identity, and page-local pending or unavailable state. It may expose local archive or unarchive actions, but has no unread, attention, follow, or persisted task-status affordances. _Avoid_: Task card, prompt-derived summary, local status row

**Workspace Target**: The project, workspace, worktree, or remote development environment used as an ACP Session's `cwd`. _Avoid_: Current workspace, repository

**Known Workspace Target**: A Workspace Target explicitly authorized and retained in the local Workspace Catalog. Only available Known Workspace Targets participate in Agent Session discovery. _Avoid_: Recent folder, arbitrary repository

**Unavailable Workspace Target**: A Known Workspace Target that is no longer authorized or currently reachable. Its Project Group and Agent Sessions are omitted from the current browser snapshot until availability is restored; no local Task record keeps it visible. _Avoid_: ACP stopped state, deleted Agent Session

**Workspace Catalog**: The user-scoped, local-profile collection of explicitly managed Platform Workspaces and Personal Projects. This project catalog is the only Agentic Layout data for which local storage remains authoritative. It is not stored in repository or workspace configuration, and recent workspaces are not automatically admitted. _Avoid_: Session catalog, recent workspace list, repository browser

**Platform Workspace**: A Known Workspace Target supplied and authorized by the Web IDE host platform. _Avoid_: Built-in project, shared folder

**Personal Project**: A user-created Known Workspace Target backed by a directory in platform-authorized storage and assigned a user-facing project name. _Avoid_: Custom workspace, arbitrary path

**Project Name**: A mutable user-facing label for a Project Group that is independent of the backing directory name and path. Clearing it returns the Project to its derived default label. The full authorized path remains available on hover. _Avoid_: Folder name, Session title

**Session Launch**: The Agentic Layout flow that opens a page-local draft and creates an ACP Session for the selected Agent and Workspace Target. After the first prompt is accepted, OpenSumi ensures the target is in the Workspace Catalog and refreshes Agent discovery; it does not create a Durable Task record. Failure or cancellation preserves the previous active Session and unsent draft. _Avoid_: Durable Task creation, projectless chat

**Session Draft**: The Agent-bound composition state opened before the first prompt. It is page-local, is not a Session Browser row by itself, and is not restored from legacy pending-launch data after reload. It may own an ordinary draft-bound ACP Session. _Avoid_: Persisted Task Draft, local history row

**Draft-bound ACP Session**: An ordinary ACP Session created for a Session Draft, including for Agent-provided slash-command metadata. It creates no local Task record and may appear in the Agent Session Browser when the Agent returns it from `session/list`. _Avoid_: Hidden Session, local Draft record

**Project Management**: The Agent Session Browser capability for adding, renaming, revalidating, and removing Known Workspace Targets without changing the IDE Workspace. _Avoid_: Session mutation, recent-workspace import

**Project Addition**: The action that authorizes a developer-selected directory as a Known Workspace Target. Adding an existing target reuses and revalidates it rather than creating a duplicate. _Avoid_: New Session creation, Workspace switch

**Project Removal**: The action that removes a manually added Project from the local Workspace Catalog when the current Agent snapshot has no Sessions for it, including locally archived Sessions. Legacy Task records do not block removal and remain untouched. _Avoid_: Agent Session deletion, legacy-data migration

**Project Management Menu**: The overflow menu on a Project Group containing Rename and, when allowed, Project Removal. It is separate from the group's visible New Session action. _Avoid_: Session actions, task archive menu

**Project-group New Session**: The single icon action on a Project Group that opens a Session Draft in that group's Workspace Target with the resolved Agent. It does not change the IDE Workspace and does not write a local Task record. _Avoid_: Project switcher, add project

**Open Agentic Layout**: The layout-switch action that activates the `agentic` layout and triggers an Agent Session discovery refresh. It does not register, duplicate, move, or otherwise change an ACP Session. _Avoid_: Session import, Task registration, cross-workspace navigation

**Session Title**: The human-readable title returned by the Agent in `session/list`. When missing or blank, Agentic Layout displays a generic unnamed-session label and never derives a title from a local prompt. _Avoid_: Prompt-derived title, local task summary

**Project Agent Recall**: The ACP Agent most recently selected for a new Session in a Project Group. It influences future launch defaults only and never filters or reroutes discovered Sessions. _Avoid_: Session owner inference, globally last-used Agent

**ACP Task Status**: The live task status rendered from an ACP session and thread currently observed by Agentic Layout: `initializing`, `ready`, `running`, `stopping`, `stopped`, or `error`. Agentic Layout does not infer a `completed` status; `ready` means the ACP Agent is waiting for another prompt. _Avoid_: Frontend task state, completion status, persisted status snapshot

**Last-known ACP Task Status**: The most recently observed ACP Task Status retained for a Task whose session has not yet been validated and observed in the current page lifecycle. It must be presented as historical rather than as the Task's current live status. _Avoid_: ACP Task Status, current status

**ACP Task Action**: An action explicitly made available by ACP for a Task Conversation. Agentic Layout renders and forwards only these advertised actions; it does not add its own stop, retry, or lifecycle controls. _Avoid_: Frontend retry, synthetic task action

**ACP Slash Command Catalog**: The session-scoped set of slash commands advertised by the ACP Agent for a Task Conversation, including Agent-provided skills. The catalog is authoritative only for its originating Task Conversation and is distinct from OpenSumi built-in chat commands. _Avoid_: Global skill list, local SKILL.md scan, built-in slash command registry

**ACP Agent Skill**: A skill whose installation and definition are owned by one ACP Agent. Each Task Conversation exposes only the ACP Slash Command Catalog that this Agent makes available in that conversation's context. _Avoid_: IDE-global skill, Session-owned skill definition

**ACP Slash Command Catalog Update**: A complete replacement ACP Slash Command Catalog sent by the ACP Agent for a Task Conversation when its available commands change. It is also included when the Task Conversation becomes live after restoration. _Avoid_: Client pull, command delta, local skill scan

**Slash Command Freshness**: The user-visible guarantee that opening the slash command menu for a Live Ready Task Conversation reflects the latest ACP Slash Command Catalog delivered or restored by its ACP Agent. _Avoid_: Client pull guarantee, background polling guarantee, installation-complete notification

**Slash Command Execution Validation**: The ACP Agent's final decision whether a submitted slash command is currently executable. A stale or removed command preserves the developer's draft and yields a structured unavailable-command result rather than changing or discarding the draft. _Avoid_: Client-only authorization, silent command removal, draft reset

**ACP Attention Signal**: A structured ACP-originated request that requires developer action, such as a Permission Request or an Agent-provided input request. Agentic Layout renders pending signals and does not infer them from conversation content. _Avoid_: Attention state, notification

**Permission Request**: An Agent-originated request for a user decision before a protected operation proceeds. The Agent supplies the available decisions, while OpenSumi routes the request, applies existing rules, and prevents the Agent from granting itself permission. _Avoid_: Permission prompt, Agent approval

**Permission Decision**: The selected Agent-provided outcome such as allow once, allow always, reject once, or reject always, made by the developer or resolved by an existing OpenSumi permission rule. _Avoid_: Permission policy, tool result

**Agentic Chat View**: The primary conversation area to the right of the Agent Session Browser. It restores and continues the selected Agent Session without changing the IDE Workspace. When the Session's Workspace Target differs from the current IDE Workspace, its header renders an Agent Execution Context Indicator. _Avoid_: Separate review application, local transcript replay

**Agent Session Selection**: The interaction that resolves the Session's captured `{agentId, cwd}` route and calls the originating Agent's `session/load`. All load-time `session/update` notifications and retained client-submitted User Prompt replay updates from the active ACP Thread are buffered into a replacement model; only a successful load may atomically replace the previous active Session. Live attachment begins independently afterwards. When selections overlap, only the latest intent may become active and superseded loads release only their own resources. _Avoid_: Task-registry lookup, Workspace navigation, eager attachment commit

**Pending Agent Session Selection**: The page-local selection intent while `session/load` is pending. It is represented by a spinner on the requested Session Row, does not replace the current active Session, and does not block selecting another row. _Avoid_: Active Session, ACP task status

**Failed Agent Session Selection**: A page-local unavailable marker set when `session/load` fails. It preserves the previous active Session and is cleared by a later successful retry of the same Session. _Avoid_: Durable error record, automatic draft fallback

**Transcript Ready**: The Agent Session condition reached only after `session/load` has returned successfully and its buffered Agent history can be committed consistently. Transcript Ready is sufficient to replace the previous Agentic Chat View and does not imply that live attachment has resumed. _Avoid_: Metadata-only model, Live Ready, fully connected

**Live Ready**: The independent Agent Session condition in which new prompts and ACP progress can be exchanged with its originating ACP Agent. An Agent Session may be Transcript Ready before it is Live Ready; attachment failure must retain readable restored history and use the existing connection retry behavior. _Avoid_: Transcript Ready, page ready, history loaded

**Agent Execution Context Indicator**: The persistent Agentic Chat View header label shown only when the selected Session's Workspace Target differs from the current IDE Workspace. It presents the target's project label and exposes its complete path on hover, but does not navigate, change the IDE workspace, or alter the file tree and editor. _Avoid_: Workspace switcher, project picker, navigation breadcrumb

**Task Artifact**: Server-retained supplemental data produced by an Agent Task, including file diffs and test or command summaries, that Agentic Chat View can present alongside the activated Workspace Target. _Avoid_: Workspace snapshot, task log

**Read-only Task Diff**: The Task Artifact view of file changes that supports inspection only and does not independently verify exclusive authorship under Shared Workspace Concurrency. Editing, inline feedback, accepting, rejecting, and reverting changes are outside B-lite and require conversation follow-up or direct editing in the activated Workspace. _Avoid_: Review editor, change approval

**Workspace-aware Session Switch**: The explicit transition that opens a different Workspace Target in the IDE. It is not part of Agent Session Selection. If used by a future explicit navigation action, it reuses the current browser page, opens the target Workspace path, and reloads the IDE; when the current Workspace has unsaved edits, the developer must choose to save all, discard changes, or cancel. It never creates a new ACP Session. _Avoid_: Session selection, chat-only switch, new browser window, Workspace Handoff
