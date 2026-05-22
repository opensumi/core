# Session-Bound Permission Dialogs — Acceptance Test Cases

> **Date:** 2026-05-22 **Branch:** `feat/acp-v2` > **Spec:** `docs/superpowers/specs/2026-05-22-session-bound-permission-dialogs-design.md`

---

## Background

Multiple ACP threads can run concurrently, each triggering permission requests. Permission dialogs are now bound to the currently active chat session:

- Only show permission dialogs for the session the user is viewing
- Non-active session permission requests queue and persist (no auto-timeout)
- Switching to a session with queued dialogs shows them
- Deleting a session clears all its unhandled dialogs and cancels pending requests

---

## Prerequisites

1. Enable ACP mode with at least one MCP server configured for permission validation (e.g., file read/write, command execution)
2. Create at least two ACP sessions (two separate conversations)

---

## Test Case 1: Active session permission dialog displays normally

| # | Action | Expected |
| --- | --- | --- |
| 1 | In Session A, send a message that triggers a permission request (e.g., ask agent to edit a file) | Permission confirmation dialog appears |
| 2 | Click "Allow Once" | Dialog closes, agent continues execution |

---

## Test Case 2: Non-active session requests do NOT show and do NOT time out

| # | Action | Expected |
| --- | --- | --- |
| 1 | In Session A, send a message that triggers a permission request | Dialog appears |
| 2 | **Do not interact** with the dialog — switch to Session B | Session A's dialog disappears from view |
| 3 | In Session B, send a message that also triggers a permission request | Session B's dialog appears |
| 4 | Wait **longer than 60 seconds** (the previous default timeout) | **Both dialogs are still present — neither auto-closed** |

> This is the core behavior change: dialogs persist until explicitly resolved, no matter how long they wait.

---

## Test Case 3: Switching back shows queued dialog

| # | Action | Expected |
| --- | --- | --- |
| 1 | In Session A, trigger a permission request — dialog appears | Dialog displays normally |
| 2 | Switch to Session B (without resolving A's dialog) | Session A's dialog disappears from view |
| 3 | Switch back to Session A | **Session A's permission dialog reappears**, fully interactive |

---

## Test Case 4: Cross-session permission requests do not interfere

| # | Action | Expected |
| --- | --- | --- |
| 1 | In Session A, trigger a permission request | Session A dialog appears |
| 2 | In Session A's dialog, click "Allow Once" | Session A dialog closes |
| 3 | Switch to Session B | Session B's permission dialog appears (if B has queued requests) |
| 4 | Click "Allow Once" | Session B dialog closes |
| — | Overall | Both sessions' permission requests complete normally, **no requests lost or timed out** |

---

## Test Case 5: Deleting a session clears all unhandled dialogs

| # | Action | Expected |
| --- | --- | --- |
| 1 | In Session A, trigger a permission request — **do not resolve** | Session A dialog appears |
| 2 | Switch to Session B, **delete Session A** | — |
| 3 | Switch back to Session A (or a newly created session) | **The previous Session A dialog is NOT shown** |
| 4 | Verify the node-side permission request received a `cancelled` response | Agent receives a cancel notification instead of waiting indefinitely |

---

## Test Case 6: Single session with multiple queued requests

| #   | Action                                                     | Expected                                     |
| --- | ---------------------------------------------------------- | -------------------------------------------- |
| 1   | In Session A, trigger 2 permission requests simultaneously | First dialog appears                         |
| 2   | Click "Allow Once"                                         | First dialog closes                          |
| 3   | Observe                                                    | **Second dialog appears** (FIFO queue order) |
| 4   | Click "Allow Once"                                         | Second dialog closes                         |

---

## Pass / Fail Criteria

- **All 6 test cases must pass**
- After waiting 60s+, dialogs **must NOT auto-dismiss** (core change: timeout removed)
- Switching sessions must correctly show the corresponding session's queued dialogs
- Deleting a session must clean up all its permission dialogs and cancel pending requests on the node side
