# Make ACP Chat New Chat and New Task One-Step Actions

Status: ready-for-agent

## Problem Statement

Developers using the Agentic Layout ACP Chat header currently click the `+` action, wait for an ACP Agent menu, and then click an Agent before a Task Draft is opened. The common path is therefore longer than the control suggests: the primary `+` looks like a direct New Task action but behaves only as a menu trigger. The header also does not advertise a keyboard shortcut, so developers working in the editor must discover the control, move to the pointer, open the menu, and make a second selection for every new task.

The current interaction obscures which recalled ACP Agent would be used by default, even though Agentic Layout already has Project Agent Recall and a deterministic fallback order. It also treats the explicit Agent override as mandatory instead of exceptional. Classic/IDE Layout has a separate ACP Chat whose `+` already opens a Chat Draft directly, but it lacks the same command, shortcut discoverability, hidden-panel behavior, and consistent focus flow.

The product language also needs to remain precise. New Chat and New Task initially open a Chat Draft or Task Draft; they do not eagerly create an ACP session. The first Prompt creates the ACP session, and a Task Draft becomes a Durable Agent Task at that boundary.

## Solution

Make the primary ACP Chat creation path one step in both layouts while preserving their different meanings.

In Agentic Layout, replace the header's menu-only `+` with a compact split action. Clicking the primary `+` immediately opens a Task Draft using the resolved Project Agent Recall. A permanently visible adjacent dropdown remains available for explicit ACP Agent selection and Agent Configuration. Choosing an Agent from that menu immediately opens the Task Draft, updates Project Agent Recall, and does not modify the user-level default Agent.

In Classic/IDE Layout, retain the existing single `+` and its direct New Chat behavior. Do not add an Agent dropdown to Classic ACP Chat.

Register two layout-specific, user-remappable commands that share the same default shortcut:

- `AI Chat: New Chat` in Classic/IDE Layout.
- `Agent: New Task` in Agentic Layout.
- macOS default: `⌘⌥N`.
- Windows/Linux default: `Ctrl+Alt+N`.

The commands are globally available within their respective layouts, including when focus is in the editor. If ACP Chat is hidden, the command reveals it before opening the relevant draft and focusing the main input. Header tooltips display the effective user binding. The Agentic primary action also identifies the recalled Agent, for example `New Task with OpenCode (⌘⌥N)`.

Preserve lazy ACP session creation, unsent user-authored draft text and attachments, running Agent Tasks, Workspace Target safety, and failure atomicity. Do not introduce custom keyboard navigation for the split button; native button behavior remains sufficient because New Task itself has a dedicated shortcut.

## User Stories

1. As a developer in Agentic Layout, I want one click on the header `+` to open a Task Draft, so that ordinary New Task creation does not require an Agent-menu round trip.
2. As a developer in Agentic Layout, I want the primary `+` to use the Project Agent Recall, so that repeated tasks for the same Project use the Agent I normally choose there.
3. As a developer in Agentic Layout, I want the resolved Agent to fall back predictably when no Project Agent Recall exists, so that direct New Task remains reliable for a new Project.
4. As a developer in Agentic Layout, I want the current Task Conversation's Agent to be considered before the user-level default, so that follow-on tasks naturally use the active work context.
5. As a developer in Agentic Layout, I want the user-level default Agent and first available Agent to remain safe fallbacks, so that direct New Task works whenever any valid ACP Agent is available.
6. As a developer, I want the header tooltip to name the Agent that direct New Task will use, so that the one-click action is predictable before I invoke it.
7. As a developer, I want the header tooltip to show my effective New Task shortcut, so that I can discover the faster keyboard path.
8. As a developer who has changed the default keybinding, I want the tooltip to display my actual binding rather than a hard-coded shortcut, so that the UI never teaches an obsolete key.
9. As a developer who has removed the keybinding, I want the tooltip to omit an unavailable accelerator cleanly, so that it does not claim a shortcut exists.
10. As a developer, I want an always-visible dropdown beside the Agentic `+`, so that I can see that explicit Agent selection is still available.
11. As a developer, I want the dropdown tooltip to say `Choose Agent`, so that its purpose is distinct from direct New Task.
12. As a developer, I want clicking an Agent in the dropdown to launch immediately, so that an explicit override still takes only two clicks.
13. As a developer, I want an explicit Agent choice to update Project Agent Recall, so that the Project remembers the Agent I most recently selected for Task Launch.
14. As a developer, I want a one-off Project Agent choice not to modify my user-level default Agent, so that project-specific work does not change unrelated future chats.
15. As a developer, I want Agent Configuration to remain available from the Agentic dropdown, so that I can repair or change the ACP Agent Catalog without leaving the header workflow.
16. As a developer with no configured ACP Agent, I want the Agentic primary `+` to be visibly disabled, so that the UI does not promise an impossible Task Launch.
17. As a developer with no configured ACP Agent, I want the Agentic dropdown to remain available for Agent Configuration, so that the disabled launch path still offers recovery.
18. As a developer who invokes New Task by shortcut with no ACP Agent, I want a non-blocking explanation and a `Configure Agents` action, so that the command does not fail silently or force an unexpected navigation.
19. As a developer in Classic/IDE Layout, I want the existing `+` to continue opening a Chat Draft directly, so that the familiar Classic workflow does not gain an unnecessary Agent menu.
20. As a developer in Classic/IDE Layout, I want a New Chat shortcut, so that I can start a separate ACP conversation without moving focus from the editor to the header.
21. As a developer in Agentic Layout, I want a New Task shortcut, so that I can start a distinct objective without using the pointer.
22. As a developer who moves between Classic and Agentic Layout, I want the same physical shortcut to perform the layout-appropriate action, so that the interaction remains easy to remember.
23. As a developer, I want the command palette to name the actions according to their layout semantics, so that New Chat is not confused with New Task.
24. As a developer, I want both commands to appear in keyboard shortcut settings, so that I can inspect, remove, or rebind them through normal IDE mechanisms.
25. As a developer, I want `⌘⌥N` on macOS and `Ctrl+Alt+N` on Windows/Linux by default, so that New Chat and New Task avoid the existing New File binding and browser-reserved shortcuts.
26. As a developer, I want the shortcut to work while the editor has focus, so that I can move directly from coding into a new ACP objective.
27. As a developer, I want the shortcut to reveal ACP Chat when the panel is hidden, so that the command never changes conversation state invisibly.
28. As a developer, I want a successful New Chat or New Task action to focus the main input, so that I can start typing immediately.
29. As a developer with an existing unsent draft, I want New Chat or New Task to preserve my user-authored text, so that an accidental action does not discard work.
30. As a developer with draft attachments, I want those attachments preserved in the new draft, so that the action does not silently remove input context.
31. As a developer with a preserved draft, I want the caret placed at the end after launch, so that I can continue editing naturally.
32. As a developer, I want New Chat to open a Chat Draft without eagerly creating an ACP session, so that empty chats are not persisted merely because I invoked the action.
33. As a developer, I want New Task to open a Task Draft without eagerly creating an ACP session or Durable Agent Task, so that task persistence begins only when I submit a real Prompt.
34. As a developer, I want the first accepted Prompt in a Task Draft to create its Task Conversation and Durable Agent Task, so that the existing one-Task-one-session model remains intact.
35. As a developer with a selected Agent Task, I want header New Task to retain that Task's Workspace Target, so that the new Agent works in the context shown by Agentic Chat.
36. As a developer without a selected Agent Task, I want header New Task to use the current IDE Workspace Target, so that the action has a clear project context.
37. As a developer viewing a Task for another Workspace Target, I want direct New Task to target that selected Task's Workspace Target without navigating the IDE, so that Task Launch remains session-first.
38. As a developer whose selected Workspace Target is unavailable, I want Agentic direct New Task disabled rather than silently redirected to the current IDE Workspace, so that the Agent never starts in the wrong directory.
39. As a developer, I want a failed Task Launch to preserve my previous Active Task and unsent draft, so that the error does not disrupt ongoing work.
40. As a developer, I want Task Launch failures to use a non-blocking message, so that I can understand the problem and continue working.
41. As a developer, I want rapid repeated clicks or shortcut presses to produce at most one Task Draft, so that asynchronous target validation cannot create duplicate launches.
42. As a developer, I want the Agentic split action to show a compact busy state while Task Launch is pending, so that I know my input was accepted.
43. As a developer, I want both parts of the Agentic split action temporarily unavailable during an in-flight launch, so that I cannot race direct and explicit Agent choices.
44. As a developer with a running Agent Task, I want New Task to leave that Task running, so that separate objectives can continue on independent ACP Threads.
45. As a developer, I want the newly opened Task Draft to become the current conversation while the previous Task remains in the Agent Task List, so that parallel work stays discoverable.
46. As a developer, I want native button activation to remain available for the header controls, so that the UI retains basic platform accessibility.
47. As a developer, I do not want custom ArrowDown or menu-navigation behavior added to the split action, so that the feature stays focused on the dedicated New Task shortcut.
48. As a screen-reader user, I want the New Chat, New Task, and Choose Agent controls to retain distinct accessible names, so that the compact icon-only actions are understandable.
49. As a developer, I want Classic ACP Chat history and existing session-selection behavior to remain unchanged, so that adding a shortcut does not alter conversation management.
50. As a developer, I want Agentic maximize/restore behavior to remain adjacent and unchanged, so that the header improvement does not regress panel layout controls.
51. As an OpenSumi maintainer, I want pointer actions and command actions to share the same launch orchestration, so that Agent resolution, failure behavior, and single-flight rules cannot diverge.
52. As an OpenSumi maintainer, I want layout context to select the correct command behavior, so that Classic New Chat can never accidentally create an Agent Task and Agentic New Task can never become an unbound chat.
53. As an OpenSumi maintainer, I want the shortcut hint derived from the keybinding registry, so that user overrides and platform-specific accelerator formatting remain authoritative.
54. As an OpenSumi maintainer, I want this feature to require no ACP protocol, persisted schema, or extension-facing contract changes, so that a local UX improvement has a narrow compatibility radius.
55. As an OpenSumi contributor, I want deterministic tests for direct launch, explicit override, shortcut dispatch, hidden-panel reveal, focus, draft preservation, and failure atomicity, so that future header changes cannot reintroduce the long interaction chain.
56. As an OpenSumi contributor, I want runtime coverage in both Classic and Agentic Layout, so that component mocks cannot hide a broken global keybinding or panel-focus interaction.

## Implementation Decisions

- Agentic Header New Task becomes a compact split action. The primary segment renders the existing `+` icon and launches directly; the adjacent dropdown segment is always visible and opens the ACP Agent menu.
- The Agentic primary segment resolves its ACP Agent from Project Agent Recall first, then the current Task Conversation's Agent, then the user-level default, then the first available validated ACP Agent.
- The Agentic primary tooltip includes the resolved Agent label and the effective shortcut. The dropdown tooltip is `Choose Agent`.
- Selecting an ACP Agent from the dropdown immediately performs Task Launch with that Agent. It updates Project Agent Recall for a registered Project but does not write the user-level default Agent preference.
- Agent Configuration remains separated from Agent selection by the existing menu separator and continues to open the existing Agent configuration surface.
- When no ACP Agent is available, the Agentic primary segment is disabled and explains why; the dropdown remains enabled so Agent Configuration is reachable.
- When the resolved Workspace Target is unavailable, Agentic direct launch is disabled. The implementation must not fall back to another Workspace Target.
- Classic/IDE Layout retains a single direct New Chat `+`. It does not gain the Agentic split action or an Agent selector.
- Two commands are registered through the existing browser command and keybinding contribution system: one for Classic New Chat and one for Agentic New Task.
- The commands use mutually exclusive layout context conditions and share the default `ctrlcmd+alt+n` binding. They remain independently visible and user-remappable in the command palette and keyboard shortcut settings.
- `ctrlcmd+n` is not used because OpenSumi already binds it to New Untitled File in Electron. `ctrlcmd+shift+n` is not used because browsers commonly reserve it for a private/incognito window.
- The command layer derives displayed accelerators from the existing keybinding registry and platform formatter. Tooltip text must update when keybindings change and omit the accelerator when no binding resolves.
- Both commands are global within their applicable layout rather than limited to chat focus. They may be triggered while the editor or another workbench surface has focus.
- If ACP Chat is hidden, command execution reveals the existing ACP Chat slot before applying draft state. It does not create a second view or change IDE layout composition.
- A successful command or pointer launch focuses the existing main ACP input and places the caret at the end of the preserved draft.
- New Chat enters a Chat Draft through the existing Classic ACP draft path. New Task enters a Task Draft through the existing target-aware Agentic Task Launch path.
- ACP session creation remains lazy. Invoking the pointer action or command alone does not create or persist an ACP session. The first accepted Prompt remains the creation boundary.
- Task durability remains lazy. A Task Draft becomes a Durable Agent Task only when the first accepted Prompt is registered with its Task Conversation.
- User-authored unsent draft text and attachments are preserved when moving into a Chat Draft or Task Draft. The feature does not introduce a new persisted per-session draft model.
- Pointer and command entry points delegate to shared browser-side launch orchestration rather than duplicating Agent resolution, Workspace Target resolution, visibility, focus, busy state, notification, or failure rules in React and command handlers.
- Agentic Task Launch is single-flight at the user-action boundary. While a launch is pending, both split segments and the New Task command reject repeated activation and expose a compact busy state.
- A failed Agentic Task Launch is atomic from the user's perspective: the previous Active Task, selection, permission context, and unsent draft remain active. No blank or unbound draft is shown.
- Invoking Agentic New Task while another Agent Task is running does not stop or cancel it. Existing shared-Workspace concurrency and independent ACP Thread behavior remain authoritative.
- The split action receives no custom ArrowDown, Home/End, or menu-roving keyboard implementation. Native button behavior is retained, and New Task keyboard efficiency is provided by the dedicated command.
- Icon-only controls retain localized accessible names, visible focus treatment, and theme-compatible styling. New user-facing copy and command labels are localized through the existing i18n system.
- Classic history, Agentic Task List, Project-group New Task, maximize/restore, Workspace behavior, editor behavior, and file-tree behavior remain unchanged except where they consume the shared command or focus outcome.
- No ACP protocol, node-side Agent process, MCP, persisted schema, Task Registry schema, extension API, or public package contract change is required.

## Testing Decisions

- A good test asserts user-observable behavior: which layout action runs, whether ACP Chat becomes visible, whether a Chat Draft or Task Draft is shown, which Agent and Workspace Target are selected, where focus lands, what draft content remains, whether an ACP session was created, and what happens after failure. Tests should not assert private React state, helper names, or implementation-specific event counts unless those counts represent the single-flight contract.
- The primary acceptance seam is the existing running-IDE ACP Chat BDD/Playwright flow. One layout-aware scenario should exercise the real default shortcut in Classic and Agentic Layout, including editor focus, hidden-panel reveal, input focus, lazy session creation, and the appropriate New Chat versus New Task result.
- The runtime Agentic pass should verify that primary `+` opens a Task Draft without first opening the Agent menu, that the tooltip identifies the recalled Agent and effective shortcut, and that the always-visible dropdown still opens the Agent list.
- The runtime explicit-override pass should select a different ACP Agent, verify immediate Task Draft launch, verify the selected Workspace Target is unchanged, and verify a later direct launch recalls that Project Agent without changing the user-level default.
- The runtime Classic pass should verify that the existing single `+` and `AI Chat: New Chat` shortcut both enter a Chat Draft, preserve the Classic history surface, and do not render an Agent dropdown.
- The runtime lazy-creation assertion should compare ACP session state before action, after draft entry, and after the first accepted Prompt. No new ACP session or Durable Agent Task may exist at the intermediate draft step.
- The existing full ACP Chat view/header component test is the focused UI seam for split-action rendering, layout-specific variants, tooltip text, disabled/no-Agent state, busy state, preserved draft, and input focus. Tests should exercise rendered controls and service outcomes rather than component implementation details.
- The existing Agentic Task Launch menu component tests are prior art for Project Agent Recall, explicit Agent selection, Agent Configuration, no-Agent behavior, and project-group versus chat-header variants. They should be updated to assert direct primary launch and the separate dropdown.
- The existing browser command/keybinding contribution seam should verify that the two commands are registered with the same default binding and mutually exclusive Classic/Agentic context conditions. It should also verify command enablement, command-palette labels, and user-remappable registration without simulating raw browser keyboard events.
- The existing panel-layout context-key tests are prior art for proving Classic and Agentic context values. They remain the source of truth for command gating.
- The existing Agentic Workspace switch/launch service tests are the focused orchestration seam for Agent resolution, Project Agent Recall updates, Workspace Target availability, latest-action protection, parallel running Tasks, and failure atomicity.
- A single-flight test should defer Task Launch, invoke the primary action and shortcut repeatedly, assert only one launch is accepted, assert both split segments expose the pending state, and assert controls recover after success and failure.
- A no-Agent test should assert that the Agentic primary segment is disabled, the dropdown still reaches Agent Configuration, and shortcut invocation produces one non-blocking recovery message without entering a Task Draft.
- An unavailable-target test should select a Task for an unavailable Workspace Target and assert that neither pointer nor shortcut falls back to the current IDE Workspace.
- A failure-atomicity test should begin with an Active Task and unsent draft, reject target validation or Task Launch, and assert that the same Active Task, selection, text, attachments, and permission context remain visible.
- A parallel-work test should begin with a running Agent Task, invoke direct New Task, and assert that the old Task remains running in the Task List while the new Task Draft becomes current.
- A keybinding-display test should change or remove the registered binding and assert that both layout tooltips reflect the resolved registry value rather than the default literal.
- Existing Agentic task-workbench Playwright coverage and ACP chat agentic history/keyboard BDD scenarios are prior art for real layout composition, New Task targeting, header actions, input focus, and stable selectors.
- Focused Jest tests, the affected TypeScript reference, the relevant runtime BDD/Playwright scenario, and `git diff --check` form the completion gate.

## Out of Scope

- Changing ACP session creation, loading, attachment, cancellation, or transport protocols.
- Eagerly creating an ACP session when New Chat or New Task is invoked.
- Creating a Durable Agent Task before the first accepted Prompt.
- Changing the one-Agent-Task-one-ACP-session relationship.
- Adding an Agent selector or split action to Classic/IDE Layout.
- Changing Project-group New Task behavior, Project Management, Task List structure, task archive behavior, task titles, unread state, attention indicators, or Task Artifacts.
- Changing the ACP Agent Catalog, accepting arbitrary Agent endpoints or commands, or redesigning Agent Configuration.
- Modifying the user-level default Agent as a consequence of an explicit Agentic header override.
- Falling back from an unavailable selected Workspace Target to the current IDE Workspace.
- Stopping, cancelling, serializing, isolating, or conflict-detecting other running Agent Tasks when New Task is invoked.
- Persisting input drafts per Task or Chat across browser reloads as part of this feature.
- Adding custom ArrowDown, roving focus, Home/End, or Escape behavior specifically for the split button menu.
- Changing IDE layout lifecycle, ACP Chat slot composition, editor behavior, file-tree behavior, activity-bar behavior, or maximize/restore behavior.
- Adding mobile-only gestures or a mobile keyboard shortcut surface.
- Changing shortcuts for New File, browser window management, Inline Chat, or unrelated commands.
- Introducing a new public package API, extension-facing command contract, persisted schema, or ADR.

## Further Notes

- The canonical terms are Chat Draft for Classic New Chat before an ACP session exists, and Task Draft for Agentic New Task before an ACP session or Durable Agent Task exists.
- The ACP Chat and Agentic Layout glossaries have been updated with Chat Draft, Task Draft, direct Project Agent Recall behavior, and Task Launch failure atomicity.
- The feature follows the accepted composition and session-first decisions: the Agent Task List remains inside the ACP Chat Slot, Task selection and launch do not navigate the IDE, and a failed operation preserves the previous Active Task.
- Existing decisions continue to govern Agent Catalog ownership, one Task Conversation per Agent Task, and shared-Workspace ACP Thread concurrency.
- This PRD narrows and completes the previously approved Agentic header direction: direct `+` is the common path, and the adjacent dropdown is the explicit Agent override.
- The local issue tracker configuration requires PRDs to remain under `.scratch/`; no GitHub, GitLab, Dima, or other remote publication is permitted.
