# Agentic Task List Workbench Style Design

## Goal

Make the Agentic Layout Agent Task List feel native to the OpenSumi workbench while preserving the existing task model, project grouping, task selection, launch, archive, and attention behavior.

## Scope

This design changes only the visual presentation of the Agent Task List and its direct controls in Agentic Layout. It does not change Agent Task registry data, Project Catalog behavior, Task Launch behavior, Session-first Task Selection, ACP status semantics, chat message rendering, editor/file-tree layout, or IDE Layout lifecycle.

## Visual Direction

The approved direction is OpenSumi workbench tree/list styling as the base, with a small amount of Agent status emphasis. The Task List should read like a native side-region list, close to Explorer, Open Editors, and tree-view rows, rather than a standalone task-management panel.

The design must avoid card-like Task Rows, persistent text action buttons, large rounded containers, branded Agent rails, `AGENT` or `LIVE` labels, and decorative gradients. Status should be legible but secondary to the task title and list structure.

## Container

The Task List keeps its existing persistent, resizable left subregion inside the ACP Chat Slot. Its container should use OpenSumi workbench surfaces:

- Header surface: `editorGroupHeader-tabsBackground` or the surrounding Agentic chat header token.
- Body surface: `panel-background`, not a distinct product surface.
- Border: `panel-border` for the right split and header/search separators.
- Text: `foreground`, `descriptionForeground`, and `disabledForeground`.

The resize handle remains functional and should keep its current focus affordance.

## Header and Search

The header remains compact, approximately the same height as the Agentic chat panel header. The title should be plain and subdued. Attention count may remain as a small inline signal, not a badge-like product counter.

The Project Addition action should render as an icon-only toolbar button using OpenSumi toolbar hover treatment. The button should not look like a primary CTA.

Search remains directly below the header, using the existing input tokens. It should stay compact and aligned to the list rhythm.

## Project Groups

Each Project Group becomes a tree section row:

- Structure: disclosure chevron, Project Name, count, Project-group New Task action, Project Management action.
- Height: approximately 24px.
- Actions: icon-only; visible or visually stronger on hover/focus.
- Styling: no Project Group card, frame, or filled header background.
- Label: ellipsis overflow with full workspace path available through the existing title/hover behavior.

The section row communicates grouping, not a separate dashboard card.

## Task Rows

Task Rows become single-line native list items:

- Structure: status point, Task Title, short right-side status or time text, unread marker.
- Height: approximately 24-26px.
- Styling: flat row with small radius matching OpenSumi tree/list rows.
- Hover: `kt-tree-hoverBackground` or equivalent list hover token.
- Selection: `kt-tree-inactiveSelectionBackground` or equivalent active list selection token plus focus outline behavior consistent with OpenSumi tree items.
- Disabled unavailable-project rows keep reduced foreground/opacity without introducing a separate disabled card style.

The Task Row must not keep a permanent second line for Agent id/status metadata. Agent id and verbose state details can remain available through existing context, title text, or future tooltip treatment, but the default list row stays single-line.

## Agent Status Expression

The design borrows only restrained status emphasis from the Agent-specific mockup:

- `attention` uses the clearest status point and may use a subtle halo.
- `running` uses a focused status point and may use a subtle halo.
- `ready`, `stopped`, and `error` use small status points with existing semantic colors.
- The active Task may use a very thin left accent only if it still reads as a native list selection.

The design must not add a full-height gradient rail, Agent-branded sidebar strip, status chips, or large task labels.

## Row Actions

Archive and Unarchive become icon-only row actions that appear on hover/focus, following OpenSumi tree action behavior. They should not be visible as text buttons in the default resting state.

The action must keep accessible names such as `Archive <Task Title>` and `Unarchive <Task Title>`, and must be keyboard reachable when the row or action receives focus.

## Archived Area

The Archived Area remains collapsed by default at the bottom of the Task List. It should use the same tree/list row vocabulary as active Project Groups:

- Compact disclosure row.
- Border-top separator only.
- No framed panel treatment.
- Expanded archived Task Rows use the same single-line row style as active rows.

## Accessibility

Icon-only actions retain accessible labels and tooltips. Focus-visible styles remain explicit for resize, project actions, row actions, search, and task activation. Single-line truncation must not remove access to full Task Titles; existing `title` attributes or equivalent accessible detail should remain.

## Verification

Implementation should be validated with:

- Focused component tests for visible text/action changes if snapshots or queries depend on `Archive` or `Unarchive` text.
- Accessibility-oriented assertions for icon-only archive/unarchive and project actions.
- `git diff --check`.
- A real screenshot of Agentic Layout at a normal desktop width to confirm the list visually aligns with the OpenSumi workbench and does not overlap or clip controls.

## Non-Goals

- No changes to Agent Task registry schema or migration.
- No changes to Task Launch, Project Catalog, Project Agent Recall, or Session-first Task Selection behavior.
- No new Agent-branded design system.
- No changes to IDE Layout, file tree, editor, or shared workbench layout lifecycle.
