# Compact One-Line Agent Task Rows

Status: ready-for-agent

## Problem Statement

Developers use the Agent Task List as a compact navigation surface inside Agentic Layout. Each Task Row currently remains on one line, but the available 208–280px width is shared by the immutable Task Title, originating ACP Agent identity, primary ACP state text, unread marker, and hover-revealed Archive or Unarchive action. Long Agent identities and exceptional labels such as `Agent unavailable` or `Last known: Running` consume most of the row and are truncated into fragments that no longer communicate their meaning.

The changing combination and width of title, Agent, state, and action content also makes adjacent Task Rows difficult to scan. Developers must infer what a truncated value represents, while duplicated short Task Titles become harder to distinguish. Increasing every row to two lines would improve space but reduce the high-density navigation expected from an IDE and substantially reduce the number of visible Agent Tasks.

## Solution

Preserve the existing compact, 22px, one-line Task Row and give it a stable information hierarchy. The immutable Task Title remains the primary flexible field. The originating ACP Agent uses a compact user-facing label with a bounded width. The primary ACP state uses an icon and a short visible label only when the state or attention condition needs to be communicated; `ready` remains visually silent. The unread marker remains independent and does not disappear when state or row actions change.

Move complete, secondary detail into a non-interactive Task Row Tooltip available from pointer hover and keyboard focus. The Tooltip presents the full Task Title, full originating ACP Agent label and identity, full live or Last-known ACP Task Status wording, current ACP Attention Signal or availability condition, and any applicable retry guidance. Tooltip disclosure supplements the row but does not become the only source of essential status information.

When Archive or Unarchive is available, hover or keyboard focus reveals that action in a reserved trailing action area. The action replaces only the visible state-label area and must not change row width, move the Task Title, hide the Agent identity, or obscure the independent unread marker. Selected, hover, focus-visible, disabled, and unavailable states continue to use existing Agentic Layout and theme semantics.

## User Stories

1. As a developer, I want every Task Row to remain on one line, so that the Agent Task List retains IDE-level information density.
2. As a developer, I want the Task Title to remain the visually dominant field, so that I can scan the list by objective rather than by implementation metadata.
3. As a developer, I want Task Titles to receive the largest flexible share of each row, so that meaningful title text remains visible at the default Task List width.
4. As a developer, I want long Task Titles to truncate with an ellipsis without wrapping, so that all Task Rows keep a stable height.
5. As a developer, I want the full Task Title available on hover, so that truncation does not permanently hide its meaning.
6. As a keyboard user, I want the same full Task Title available when the Task Row receives focus, so that disclosure does not depend on a pointer.
7. As a developer, I want to see the originating ACP Agent on each Task Row, so that tasks from different Agents remain distinguishable in the unified cross-Agent Task List.
8. As a developer, I want the originating ACP Agent rendered with a compact user-facing label, so that a raw or lengthy Agent identity does not dominate the row.
9. As a developer, I want long Agent labels to use a predictable maximum width and ellipsis, so that their length does not unpredictably compress Task Titles.
10. As a developer, I want the full originating ACP Agent label and stable identity available in the Tooltip, so that the shortened row label remains unambiguous.
11. As a developer, I want a retained Task whose Agent is unavailable to continue showing its originating Agent, so that the UI does not imply fallback to another Agent.
12. As a developer, I want `ready` Tasks to omit redundant state text, so that ordinary waiting Tasks leave more room for their titles.
13. As a developer, I want running, stopped, and error Tasks to use compact visible state labels, so that I can still understand their primary ACP state without opening a Tooltip.
14. As a developer, I want Permission Requests and structured input requests to retain priority over ordinary ACP Task Status, so that required action remains visible in the compact row.
15. As a developer, I want Attention Signals to use a warning icon plus a short label, so that required action is not communicated by color alone.
16. As a developer, I want an Unavailable ACP Agent condition represented by a short visible label such as `No agent`, so that the condition fits without losing its meaning.
17. As a developer, I want an Unavailable Task Conversation represented by a short visible label such as `No history`, so that it remains distinct from an Unavailable ACP Agent.
18. As a developer, I want Last-known ACP Task Status represented as historical rather than live, so that a retained status is never mistaken for current observation.
19. As a developer, I want a compact Last-known label such as `Last: Running`, so that its historical nature remains visible without consuming the whole row.
20. As a developer, I want the Tooltip to spell out the complete live or Last-known state wording, so that compact labels do not reduce semantic precision.
21. As a developer, I want status icons to use existing Codicon and theme semantics, so that the row remains visually consistent with the OpenSumi workbench.
22. As a developer, I want the unread marker to remain visually independent from ACP Task Status and ACP Attention Signals, so that unseen output is not confused with lifecycle state.
23. As a developer, I want the unread marker to remain visible while Archive or Unarchive is revealed, so that a row action does not hide notification state.
24. As a developer, I want the selected Task Row to keep its active background and leading selection indicator, so that I always know which Task Conversation is open.
25. As a developer, I want hover, focus-visible, selected, and unavailable states to remain distinguishable in dark, light, and high-contrast themes, so that compact density does not reduce usability.
26. As a developer, I want hover-revealed row actions to occupy reserved space, so that the title and metadata do not jump when I move the pointer.
27. As a keyboard user, I want Archive and Unarchive revealed through focus as well as hover, so that row management is not pointer-only.
28. As a developer, I want Archive or Unarchive to replace only the state-label area while visible, so that the stable Task Title and Agent columns remain scannable.
29. As a developer, I want the Tooltip to remain informational rather than contain clickable controls, so that actions stay predictable and keyboard accessible in the row or its menu.
30. As a developer, I want the Tooltip to appear after a short delay, so that moving across a dense list does not produce distracting tooltip flicker.
31. As a developer, I want the Tooltip to dismiss when the pointer leaves, focus moves away, or Escape is pressed, so that it does not obscure neighboring Tasks.
32. As a screen-reader user, I want the Task Row accessible description to include its full title, originating Agent, primary state or attention condition, and unread state, so that visual truncation does not remove information.
33. As a screen-reader user, I want decorative status icons excluded from the accessibility tree, so that state information is announced once rather than duplicated.
34. As a developer using the minimum Task List width, I want the Task Title, essential exceptional state, and unread marker to remain understandable, so that resizing does not make the list unusable.
35. As a developer using the maximum Task List width, I want additional title and Agent text to become visible without changing the row anatomy, so that resizing improves readability predictably.
36. As a developer, I want neighboring rows to preserve stable column alignment regardless of whether a Task has visible status text, so that I can scan vertically without reinterpreting each line.
37. As a developer, I want repeated Agent labels and normal-state text to remain visually secondary, so that exceptional Tasks attract attention without making every row noisy.
38. As a developer, I want selecting a Task with an Unavailable Task Conversation to retain the existing click-to-retry behavior, so that the presentation change does not invent a separate Retry action.
39. As a developer, I want unavailable Agents and conversations to retain their existing activation and archive rules, so that compact presentation does not alter task lifecycle behavior.
40. As an OpenSumi maintainer, I want Task Row presentation derived from the existing ACP status, attention, availability, unread, and archive state, so that no parallel frontend lifecycle is introduced.
41. As an OpenSumi maintainer, I want compact and full labels defined from one presentation model, so that visible text, Tooltip text, accessible text, icons, and test selectors cannot drift semantically.
42. As an OpenSumi contributor, I want runtime coverage at the minimum, default, and maximum Task List widths, so that future metadata changes cannot reintroduce unreadable truncation.
43. As an OpenSumi contributor, I want deterministic coverage for live status, Last-known status, Attention, unavailable Agent, unavailable Task Conversation, unread, selected, and archive disclosure, so that every supported row combination remains usable.
44. As an OpenSumi contributor, I want this optimization isolated to Agentic Layout presentation, so that Classic ACP Chat, IDE Layout, editor, file tree, and Workspace behavior remain unchanged.

## Implementation Decisions

- The feature modifies the existing Agent Task List presentation only. It does not create a second task list, task card, table, details pane, or IDE Layout sidebar.
- Task Rows remain exactly one visual line and retain the current compact 22px height across the supported Task List width range.
- The stable visual anatomy is: flexible Task Title, bounded originating ACP Agent label, bounded primary state or attention presentation, independent unread marker, and reserved trailing row-action area.
- The Task Title is the only freely growing column. All secondary columns use explicit maximum widths so their content cannot consume the entire row.
- The originating ACP Agent uses the shortest available user-facing catalog label. If no catalog label is available, the stable retained Agent identity is used as the fallback. The complete label and identity remain available through Tooltip and accessibility text.
- Visible primary-state labels are deliberately compact. The intended vocabulary is `Running`, `Stopped`, `Error`, `Permission`, `Input`, `No agent`, `No history`, and `Last: <status>`. User-facing copy may be localized, but each locale must preserve the same semantic distinctions and compactness.
- `ready` continues to render no visible primary-state label. The UI does not introduce `completed`, `done`, `ready for review`, or any other inferred lifecycle state.
- A pending ACP Attention Signal continues to replace ordinary ACP Task Status in the primary-state area. Unread remains independent of both.
- Unavailable ACP Agent, Unavailable Task Conversation, live ACP Task Status, and Last-known ACP Task Status remain separate presentation conditions. Compact labels must not merge their underlying behavior or persistence semantics.
- The row presentation model supplies both compact and full wording. Compact wording is used in the row; full wording is used by Tooltip, accessible description, and diagnostic tests.
- The full Tooltip contains only retained discovery and presentation metadata: full Task Title, originating ACP Agent label and identity, full status or attention wording, whether the status is live or Last-known, and generic availability or retry guidance. It must not include Prompt bodies, Agent messages, credentials, commands, environment data, thoughts, tool results, or Task Artifacts.
- Tooltip disclosure is available from both hover and keyboard focus, uses a short delay appropriate for a dense IDE list, stays within the viewport, and dismisses on pointer exit, focus exit, or Escape.
- The Tooltip is non-interactive. Archive, Unarchive, task activation, and any future ACP-advertised actions remain real controls outside the Tooltip.
- Archive and Unarchive use the existing hover/focus progressive disclosure. Their control occupies a reserved trailing region and visually replaces only the state-label area; revealing it must not change Task Row geometry or hide the unread marker.
- Selected, hover, focus-visible, disabled, and unavailable presentations continue to use existing list and theme tokens. No theme-related raw color is introduced.
- The selected Task continues to expose `aria-current`; expanded Project Groups, Task activation, click-to-retry selection, unread clearing, archive eligibility, and Agent availability behavior remain unchanged.
- Status and attention icons remain decorative when equivalent accessible text is present. Each Task Row exposes one coherent accessible name or description containing full title, Agent, state or attention, availability guidance, and unread state as applicable.
- The presentation adapts within the existing 208–280px resizable Task List range. At narrower widths, secondary text truncates before the title loses its minimum usable measure; essential exceptional state retains at least its icon and compact semantic label.
- The implementation reuses the existing Task Row, Tooltip, Codicon, focus, theme, and row-action patterns. It does not add a new shared component unless the existing presentation primitives cannot satisfy keyboard-accessible disclosure without coupling to Agentic Layout.
- No ACP protocol, ACP Agent Catalog contract, Task Registry schema, persisted metadata, public package API, extension-facing API, command, or server behavior changes are required.

## Testing Decisions

- A good test asserts externally observable Task Row behavior: what text and icons are visible, which details are available from hover and focus, whether rows remain one line, whether selection and unread remain visible, whether actions cause layout movement, and whether accessible descriptions preserve full meaning. Tests should not assert private helper names or React state.
- The single primary acceptance seam is the existing running-IDE Agentic Task Workbench Playwright flow. It exercises the real resizable Agent Task List, theme variables, computed geometry, pointer hover, keyboard focus, Tooltip behavior, selection, and Archive or Unarchive disclosure in the complete workbench.
- The runtime scenario verifies Task Rows at the 208px minimum, 244px default, and 280px maximum Task List widths. At every width, rows remain 22px high, text does not wrap, titles use ellipsis when necessary, and no horizontal row overflow appears.
- The runtime scenario includes intentionally long Task Titles, long Agent labels, live Running status, Last-known Running status, Permission and Input attention, Error, Unavailable ACP Agent, Unavailable Task Conversation, unread, selected, and archive-eligible rows.
- The runtime scenario verifies that Tooltip content is complete on hover and keyboard focus, does not contain interactive controls, stays within the workbench viewport, and dismisses through the expected pointer, focus, and Escape paths.
- The runtime scenario verifies that revealing Archive or Unarchive leaves the Task Title and Agent geometry unchanged, hides or replaces only the compact state area, keeps unread visible, and exposes the action to keyboard focus.
- The runtime scenario verifies selected and focused rows through user-visible background, outline, leading selection indicator, and `aria-current` rather than relying only on generated class names.
- Focused Agent Task List component tests cover the presentation matrix that would be expensive to create repeatedly in the running IDE. They assert compact wording, full Tooltip and accessibility wording, icon semantics, live-versus-Last-known distinction, Attention precedence, ready-state silence, and unavailable-state separation.
- Existing Task Row component tests for status, Agent identity, unread, selection, lazy conversation validation, unavailable Agent handling, archive eligibility, and click-to-retry behavior are prior art and remain the focused regression seam.
- Existing Agentic Task Workbench Playwright coverage for 22px row density, title truncation, Task List resizing, hover/focus action disclosure, selection, project grouping, archive/unarchive, and real workbench composition is the runtime prior art.
- Dark, light, high-contrast dark, and high-contrast light themes must be inspected or covered at the existing theme-validation seam for readable foregrounds, status icons, focus indicators, selected rows, disabled rows, and Tooltip surfaces.
- Verification uses the narrowest affected TypeScript build, focused Agent Task List Jest tests, the Agentic Task Workbench Playwright scenario, and whitespace validation. Full repository test execution is not required unless the implementation expands beyond Agentic Layout presentation.

## Out of Scope

- Converting Task Rows into two-line items, cards, expandable summaries, tables, or a separate details pane.
- Increasing the Task Row height or widening the Task List beyond its existing resizable bounds.
- Changing Project Group layout, Project count placement, Project Management, Task Launch, search scope, grouping, ordering, archive eligibility, or Archived Area behavior.
- Renaming immutable Task Titles, generating Agent-authored titles, or adding automatic suffixes solely to distinguish duplicate titles.
- Hiding originating ACP Agent identity from the unified cross-Agent Task List or filtering Tasks implicitly by the currently selected Agent.
- Adding new ACP statuses, inferring completion, deriving attention from conversation content, or adding frontend Stop, Retry, Resume, or lifecycle actions.
- Changing Unavailable ACP Agent, Unavailable Task Conversation, Last-known ACP Task Status, unread, or ACP Attention persistence semantics.
- Adding interactive links, buttons, menus, retry controls, or settings controls inside Tooltips.
- Adding permanent deletion, pinning, custom row actions, drag-and-drop, multi-select, bulk actions, or task reordering.
- Modifying Classic ACP Chat, IDE Layout lifecycle, Workspace behavior, editor behavior, file-tree behavior, ACP protocol, Task Registry persistence, or node-side Agent startup.
- Introducing a mobile-specific layout or applying mobile touch-target dimensions to this desktop IDE list.

## Further Notes

- Canonical terminology follows the Agentic Layout domain context: Agent Task List, Task Row, Task Title, originating ACP Agent, ACP Task Status, Last-known ACP Task Status, ACP Attention Signal, Unavailable ACP Agent, Unavailable Task Conversation, Task List Metadata, and Unread Task.
- The proposal preserves the accepted single unified cross-Agent Task List and lazy Task Conversation validation decisions. It does not change Agent ownership, session routing, activation, or lifecycle authority.
- The existing domain contract already states that a Task Row is compact and that Archive or Unarchive may replace state text on hover or keyboard focus without changing layout. This PRD makes that presentation rule concrete for narrow widths and Tooltip disclosure.
- The local OpenSumi design baseline favors 13px desktop text, 22px compact secondary rows, theme tokens, stable hover and focus geometry, meaningful truncation, and keyboard-equivalent disclosure. Generic mobile spacing and touch-target guidance does not override that desktop IDE baseline.
- This PRD is published only to the repository-local `.scratch/` issue tracker. It must not be mirrored to GitHub, GitLab, Dima, or another remote tracker.
