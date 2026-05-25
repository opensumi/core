# Dev Loop Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `dev-loop` skill that orchestrates develop → verify → fix → verify → deliver, consolidate existing CDP/WebMCP skills, and migrate BDD scenarios to `test/bdd/`.

**Architecture:** The `dev-loop` skill is an orchestrator SKILL.md that delegates verification to `cdp-verification-scenarios`, manages loop state (cycle count, pass/fail), and spawns subagents for fix cycles. Two existing skills (`cdp-webmcp-bridge`, `contract-dev`) are consolidated into the remaining two.

**Tech Stack:** Markdown skills (Claude Code plugin system), BDD scenario files, `.claude/` directory structure.

---

## File Structure

### Files to Create

- `test/bdd/thread-status.scenario.md` — BDD scenario (migrated from spec)
- `test/bdd/permission-dialog.scenario.md` — BDD scenario (migrated from spec)
- `test/bdd/message-flow.scenario.md` — BDD scenario (migrated from spec)
- `test/bdd/create-session.scenario.md` — BDD scenario (migrated from spec)
- `test/bdd/switch-session.scenario.md` — BDD scenario (migrated from spec)
- `.claude/skills/dev-loop/SKILL.md` — new orchestrator skill

### Files to Modify

- `.claude/skills/cdp-verification-scenarios/SKILL.md` — absorb bridge content, update scenario path

### Files to Delete

- `.claude/skills/cdp-webmcp-bridge/SKILL.md` — content merged into verification-scenarios
- `.claude/skills/contract-dev/SKILL.md` — content merged into dev-loop
- `.claude/skills/contract-dev/reference/webmcp-examples.md` — redundant with webmcp-tool-registrar

---

### Task 1: Create `test/bdd/` directory and migrate scenarios

**Files:**

- Create: `test/bdd/thread-status.scenario.md`
- Create: `test/bdd/permission-dialog.scenario.md`
- Create: `test/bdd/message-flow.scenario.md`
- Create: `test/bdd/create-session.scenario.md`
- Create: `test/bdd/switch-session.scenario.md`

These are extracted from `docs/superpowers/specs/2026-05-25-cdp-verification-scenarios.md` and converted to the standard scenario format with `## Given`, `## When`, `## Then` headers.

- [ ] **Step 1: Create `test/bdd/thread-status.scenario.md`**

```markdown
# Scenario: Thread status shows in history list

**Trigger:** `**/acp/components/AcpChatHistory.tsx` or `**/acp/acp-agent.service.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available (`navigator.modelContext` exists)

## When

1. `webmcp`: acp_createSession → capture sessionId
2. `webmcp`: acp_sendMessage({ sessionId, message: "test" })
3. `cdp-wait`: "Chat History" text visible
4. `cdp-click`: [data-testid="acp-chat-history-button"]
5. `cdp-wait`: [data-testid="acp-chat-history-popover"] visible
6. `cdp-evaluate`: document.querySelector('[data-testid="thread-status-{sessionId}"]').textContent

## Then

- Step 6 result contains "working" or "awaiting_prompt" or "idle"
- History list contains the session item
```

- [ ] **Step 2: Create `test/bdd/permission-dialog.scenario.md`**

```markdown
# Scenario: Permission dialog auto-approval

**Trigger:** `**/permission-dialog-widget.tsx` or `**/acp/permission-routing.service.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available
- An active ACP session exists

## When

1. `webmcp`: acp_sendMessage({ message: "create a file" }) — triggers permission request
2. `webmcp`: acp_getPermissionDialogState → confirm activeDialogCount > 0
3. `webmcp`: acp_handlePermissionDialog({ optionId: "allow_once" })
4. `cdp-wait`: permission dialog disappears (wait for [data-testid="acp-permission-dialog"] absence)

## Then

- CDP evaluate_script querying [data-testid="acp-permission-dialog"] returns null
- `webmcp`: acp_getPermissionDialogState returns activeDialogCount = 0
```

- [ ] **Step 3: Create `test/bdd/message-flow.scenario.md`**

```markdown
# Scenario: Send message and receive reply

**Trigger:** `**/acp-chat-agent.ts` or `**/chat/chat.view.acp.tsx`

## Given

- Browser is at http://localhost:8080
- WebMCP is available

## When

1. `webmcp`: acp_createSession → capture sessionId
2. `webmcp`: acp_sendMessage({ sessionId, message: "hello" })
3. `cdp-wait`: assistant message appears
4. `cdp-snapshot`: get message list

## Then

- CDP take_snapshot tree contains user message "hello"
- CDP take_snapshot tree contains assistant reply content
- `webmcp`: acp_getSessionState returns threadStatus = "awaiting_prompt"
```

- [ ] **Step 4: Create `test/bdd/create-session.scenario.md`**

```markdown
# Scenario: Create new session

**Trigger:** `**/acp/acp-agent.service.ts` or related session management components

## Given

- Browser is at http://localhost:8080
- WebMCP is available

## When

1. `webmcp`: acp_createSession → capture sessionId
2. `webmcp`: acp_listSessions

## Then

- Step 2 result list contains the sessionId from step 1
- Session title is not empty
```

- [ ] **Step 5: Create `test/bdd/switch-session.scenario.md`**

```markdown
# Scenario: Switch session from history

**Trigger:** `**/components/ChatHistory.tsx` or `**/components/AcpChatHistory.tsx` or `**/acp-session-provider.ts`

## Given

- Browser is at http://localhost:8080
- WebMCP is available
- At least two sessions exist

## When

1. `webmcp`: acp_createSession → capture sessionA
2. `webmcp`: acp_createSession → capture sessionB
3. `webmcp`: acp_getSessionState → confirm current sessionId = sessionB
4. `cdp-click`: [data-testid="acp-chat-history-button"]
5. `cdp-wait`: [data-testid="acp-chat-history-popover"] visible
6. `cdp-click`: [data-testid="acp-chat-history-item-{sessionA}"]
7. `webmcp`: acp_getSessionState → confirm current sessionId = sessionA

## Then

- Step 7 returned sessionId equals sessionA
- Active session has switched from sessionB to sessionA
```

- [ ] **Step 6: Commit**

```bash
git add test/bdd/
git commit -m "test(bdd): migrate CDP/WebMCP scenarios from specs to test/bdd"
```

---

### Task 2: Merge `cdp-webmcp-bridge` content into `cdp-verification-scenarios`

**Files:**

- Modify: `.claude/skills/cdp-verification-scenarios/SKILL.md`
- Delete: `.claude/skills/cdp-webmcp-bridge/SKILL.md`

The bridge content (data-testid table, troubleshooting, verification patterns) gets appended to the verification skill as reference sections. The scenario path reference changes from `docs/superpowers/specs/` to `test/bdd/`.

- [ ] **Step 1: Update `cdp-verification-scenarios/SKILL.md` — scenario path + Phase 0**

Change the "When to Use" section's path reference and add the Phase 0 environment check. The key changes:

- Replace "A scenario file exists in `docs/superpowers/specs/` or similar" with "A scenario file exists in `test/bdd/`"
- Add a new "Phase 0: Environment Setup" section BEFORE "Phase 1: Read & Prepare"

Add this between the "When to Use" block and "### Phase 1: Read & Prepare":

````markdown
### Phase 0: Environment Setup

Run once at loop entry. Also checked before each verification run (cheap probe).

1. **Probe dev server:** `curl -s http://localhost:8080`. HTTP 200 → already running, skip.
2. **Start if needed:** If probe fails, run `yarn start` in background.
3. **Wait:** Navigate browser to target URL, `wait_for` ".sumi-workspace" or "AI Assistant".
4. **Check WebMCP:**

```javascript
// CDP evaluate_script
if (!navigator.modelContext) {
  return { available: false };
}
const tools = navigator.modelContext.getTools();
return { available: true, toolCount: tools.length, tools: tools.map((t) => t.name) };
```
````

- **Unavailable at entry:** Report **SETUP_FAILURE**, stop. Diagnose: `onDidStart` not fired, service not registered.
- **Unavailable mid-loop:** Report **SETUP_FAILURE**, stop. Tell user: "WebMCP dropped — likely dev server hot-reload. Refresh page and re-run."
- **Available with 0 tools:** `onDidStart` didn't register — check contributions.
- **Available with tools:** Proceed to Phase 1.

````

- [ ] **Step 2: Append data-testid reference table**

At the end of the file, after the "Error Classification" section, add:

```markdown
## Reference: data-testid

| Element | data-testid |
|---|---|
| Chat history button | `acp-chat-history-button` |
| Chat history popover | `acp-chat-history-popover` |
| History item | `acp-chat-history-item-{sessionId}` or `chat-history-item-{sessionId}` |
| Thread status text | `thread-status-{sessionId}` |
| Thread status icon | `acp-thread-status-{sessionId}-{status}` |
| Permission dialog | `acp-permission-dialog` |
| Permission dialog title | `acp-permission-dialog-title` |
| Permission dialog content | `acp-permission-dialog-content` |
| Permission dialog options | `acp-permission-dialog-options` |
| Permission dialog option N | `acp-permission-dialog-option-{index}` |
| Permission dialog close | `acp-permission-dialog-close` |
| ACP chat view | `acp-chat-view` |
| ACP chat input | `acp-chat-input` |
| User message bubble | `acp-chat-message-user` |
| Assistant message bubble | `acp-chat-message-assistant` |
| Tool call block | `acp-chat-tool-call` |
| Tool result block | `acp-chat-tool-result` |
| Session status indicator | `acp-session-status` |

**Note:** Two history components exist — `ChatHistoryACP` (icon-based) and `AcpChatHistory` (text-based). Both register the same `thread-status-{id}` pattern.
````

- [ ] **Step 3: Append troubleshooting section**

Add after the data-testid reference:

```markdown
## Reference: Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `navigator.modelContext` undefined | `onDidStart` didn't fire | Check `ai-core.contribution.ts` — must be in a contribution's `onDidStart`, not a module's |
| `TOOL_DISPOSED` error | Dev server reloaded, tools unregistered | Refresh page, tools re-register on start |
| `evaluate_script` returns empty | DOM not yet rendered | Add `wait_for` before querying |
| `take_snapshot` can't find element | Missing `data-testid` or a11y attributes | Add `data-testid` to component |
| `SERVICE_UNAVAILABLE` | DI service not registered | Check service registration in `browser/index.ts` |

**Important rules:**

- **WebMCP does NOT do UI assertions.** `evaluate_script` returns app state; CDP verifies DOM. Never mix them.
- **Always verify WebMCP is available** before calling tools — the bridge only works if `navigator.modelContext` exists.
- **CDP runs in the browser context.** `evaluate_script` has full DOM access — use it to read DOM elements, not app state.
- **The bridge is one-way.** CDP `evaluate_script` calls WebMCP, but WebMCP tools cannot trigger CDP operations.
```

- [ ] **Step 4: Remove duplicate verification patterns table**

The current "Verification Patterns" table in `cdp-verification-scenarios/SKILL.md` already exists (lines 150-155). The bridge had an identical one. No content change needed — just confirm it's present (it is).

- [ ] **Step 5: Delete `cdp-webmcp-bridge/SKILL.md`**

```bash
git rm .claude/skills/cdp-webmcp-bridge/SKILL.md
rmdir .claude/skills/cdp-webmcp-bridge
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/cdp-verification-scenarios/SKILL.md
git rm -r .claude/skills/cdp-webmcp-bridge/
git commit -m "refactor(skills): merge cdp-webmcp-bridge into verification-scenarios"
```

---

### Task 3: Create `dev-loop` skill

**Files:**

- Create: `.claude/skills/dev-loop/SKILL.md`

This is the orchestrator skill. It contains all 5 phases (0-4), scenario lookup, contract design rules (from `contract-dev`), fix cycle orchestration, and delivery summary.

- [ ] **Step 1: Create `.claude/skills/dev-loop/SKILL.md`**

```markdown
---
name: dev-loop
description: Use when implementing a feature or fix with automatic browser verification — "build X", "fix Y", "implement Z". Runs: develop → verify → fix → verify → deliver (max 3 fix cycles). Triggers on feature requests, not on bug diagnosis (use systematic-debugging) or code review (use requesting-code-review).
---

# Dev Loop

Orchestrates a closed-loop development workflow: **开发 → 验证 → 修复 → 验证 → 交付**. Uses CDP (Chrome DevTools MCP) for browser observation and WebMCP (`navigator.modelContext`) for app-level actions.

## When to Use

- "实现 X", "开发 Y", "create Z", "build", "implement" — feature/fix with implementation
- User wants automatic browser verification of their changes
- End-to-end delivery with BDD scenarios

**NOT for:**

- Bug diagnosis without implementation — use `superpowers:systematic-debugging`
- Code review — use `superpowers:requesting-code-review`
- Pure refactoring — no behavior change, no verification needed
- WebMCP tool registration — use `webmcp-tool-registrar`

## Architecture
```

Phase 0: 环境准备 (once) → Phase 1: 开发 → Phase 2: 验证 → { PASS → Phase 4: 交付 } → { FAIL → Phase 3: 修复 (≤3) → Phase 2 } → { FAIL ×3 → Phase 4 with diagnostics }

````

## Phase 0 — 环境准备

Runs once at loop entry. Also probed before each Phase 2 verification.

### Dev Server Detection

1. **Probe:** `curl -s http://localhost:8080` (or configured port). HTTP 200 → already running, skip.
2. **Start if needed:** If probe fails, run `yarn start` (or configured command) in background.
3. **Wait:** Navigate browser to target URL, `wait_for` ".sumi-workspace".
4. **Timeout:** 120s. Report setup failure if not ready.

Configuration (`.claude/dev-loop-config.json`, optional):
```json
{ "startCommand": "yarn start", "port": 8080, "waitSelector": ".sumi-workspace" }
````

If absent, defaults shown above. On first run, confirm with user.

### WebMCP Availability Check

```javascript
// CDP evaluate_script
if (!navigator.modelContext) {
  return { available: false };
}
const tools = navigator.modelContext.getTools();
return { available: true, toolCount: tools.length, tools: tools.map((t) => t.name) };
```

- **Phase 0 unavailable:** Report **SETUP_FAILURE**, stop. Diagnose: `onDidStart` not fired.
- **Mid-loop unavailable:** Report **SETUP_FAILURE**, stop loop. Ask user to refresh page and re-run.
- **Available with 0 tools:** Check contributions.
- **Available with tools:** Proceed to Phase 1.

## Phase 1 — 开发

### Scenario Lookup

1. **Exact filename match:** User mentions a scenario name → load `test/bdd/<name>.scenario.md`.
2. **List & ask:** If no clear match, list existing scenarios in `test/bdd/` → "Use which? [1/2/3/new]".
3. **Auto-generate:** User selects "new" → generate from description, save to `test/bdd/<kebab-case-name>.scenario.md`, present for confirmation.

### Contract Design

From the description or loaded scenario, design the contract:

- **Name:** `<module>_<action>` — what it does, not how
- **Input schema:** all parameters needed for complete intent
- **Return value:** result description, not process steps

**Contract vs Scenario:**

- **Contract** = interface (tool name, input, return shape) — implemented in code
- **Scenario** = verification steps (Given/When/Then) — exercised in browser
- A scenario may exercise one or more contracts
- Order: design contract → write scenario → implement → verify

**Contract design rules:**

- 意图优先: one tool per complete intent, not internal steps
- 参数完整: all info needed for intent, no guessing
- 结果导向: return result, not next-step instructions
- 可自证: inputs construct test data, outputs matchable

Present contract to user for confirmation before coding.

### Implementation

Write code following the contract. Use existing patterns. Register WebMCP tools if needed (delegate to `webmcp-tool-registrar`).

## Phase 2 — 验证

Delegates to `cdp-verification-scenarios` skill. The dev-loop skill provides:

- Scenario file path (from Phase 1)
- Browser context (from Phase 0)

The verification skill executes: Read → Execute → Compare → Report.

**Delegation contract:** Must output explicit "PASS: ..." or "FAIL: ..." judgments. Dev-loop relies on this to decide Phase 3 entry.

## Phase 3 — 修复 (Auto, Max 3 Cycles)

Only runs if Phase 2 produced FAIL results.

### Per Cycle

1. **Write diagnostic** to `test/bdd/.last-failure.md`:
   - Which step failed, expected vs actual, hypothesis
2. **Launch fix subagent** with:
   - Diagnostic file, scenario file
   - Scope hint: `packages/ai-native/` + git diff packages
   - Permission: read code, run codegraph, edit files
3. **Subagent:** explore within scope, diagnose, fix code, return: hypothesis + files changed
4. **Re-run Phase 2** — only failing scenarios. If all pass, run full regression (all scenarios). If regression introduces new failures, treat as new FAIL.

### Exit Conditions

- **All pass** → Phase 4
- **3 cycles exhausted** → stop, show all failures with diagnostics, ask user
- **Never retry without a code change**

### Context Management

Main session holds loop state only (cycle count, pass/fail summary). Fix cycle context lives in the subagent, discarded after completion.

## Phase 4 — 交付

No git action. No auto-commit.

Show summary:

- Scenarios run: N, Passed: X, Failed: Y
- Files changed: list
- Fix cycles used: M/3
- Any remaining issues

Stop. User decides next action.

## Scenario File Format

All scenarios in `test/bdd/`:

```markdown
# Scenario: <short description>

**Trigger:** (optional) glob pattern

## Given

- Browser is at http://localhost:8080
- WebMCP is available

## When

1. `webmcp`: tool_name({ args })
2. `cdp-wait`: "text" visible

## Then

- Expected result
```

Step types: `webmcp`, `cdp-click`, `cdp-wait`, `cdp-evaluate`, `cdp-snapshot`

````

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/dev-loop/SKILL.md
git commit -m "feat(skills): add dev-loop orchestrator skill"
````

---

### Task 4: Delete `contract-dev` skill

**Files:**

- Delete: `.claude/skills/contract-dev/SKILL.md`
- Delete: `.claude/skills/contract-dev/reference/webmcp-examples.md`

The contract-dev skill's concepts have been merged into `dev-loop/SKILL.md` (Phase 1 contract design rules, the 0-4 phase flow). The `webmcp-examples.md` is redundant with `webmcp-tool-registrar/CODE-PATTERNS.md`.

- [ ] **Step 1: Delete contract-dev**

```bash
git rm -r .claude/skills/contract-dev/
```

- [ ] **Step 2: Commit**

```bash
git rm -r .claude/skills/contract-dev/
git commit -m "refactor(skills): delete contract-dev (merged into dev-loop)"
```

---

### Task 5: Verify final structure and run self-check

**Files:**

- Verify: `.claude/skills/` structure
- Verify: `test/bdd/` structure

- [ ] **Step 1: Verify final structure**

Run:

```bash
find .claude/skills -type f | sort
echo "---"
find test/bdd -type f 2>/dev/null | sort
```

Expected output:

```
.claude/skills/cdp-verification-scenarios/SKILL.md
.claude/skills/dev-loop/SKILL.md
.claude/skills/webmcp-tool-registrar/CODE-PATTERNS.md
.claude/skills/webmcp-tool-registrar/EVALS.md
.claude/skills/webmcp-tool-registrar/INIT-FLOW.md
.claude/skills/webmcp-tool-registrar/SKILL.md
---
test/bdd/create-session.scenario.md
test/bdd/message-flow.scenario.md
test/bdd/permission-dialog.scenario.md
test/bdd/switch-session.scenario.md
test/bdd/thread-status.scenario.md
```

- [ ] **Step 2: Verify no stale references**

Check that no remaining docs reference the deleted skills:

```bash
grep -r "cdp-webmcp-bridge\|contract-dev" .claude/ docs/superpowers/ 2>/dev/null || echo "No stale references found"
```

If references are found, update them to point to `dev-loop` or `cdp-verification-scenarios` as appropriate.

- [ ] **Step 3: Verify scenario file format**

Each scenario in `test/bdd/` must have:

- `# Scenario:` heading
- `## Given`, `## When`, `## Then` sections
- Step types from: `webmcp`, `cdp-click`, `cdp-wait`, `cdp-evaluate`, `cdp-snapshot`

- [ ] **Step 4: Final commit (if any cleanup changes)**

```bash
git add .claude/ test/
git status
# Review changes, then:
git commit -m "chore(skills): verify final structure and clean up stale references"
```
