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
Phase 0: 环境准备 (once) → Phase 1: 开发 → Phase 2: 验证 → { PASS → Phase 4: 交付 }
                                                          → { FAIL → Phase 3: 修复 (≤3) → Phase 2 }
                                                          → { FAIL ×3 → Phase 4 with diagnostics }
```

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
```

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
3. **Auto-generate:** User selects "new" → generate from description using the template below, save to `test/bdd/<kebab-case-name>.scenario.md`, present for confirmation before proceeding.

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

- **All pass** → run full regression (all scenarios) → if all pass, Phase 4
- **Partial pass after 3 cycles** → Phase 4 with diagnostics (list remaining failures)
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

**Auto-generated scenario template:** When generating scenarios from a description, follow this structure:

1. **Given** always includes browser URL and WebMCP availability check
2. **When** starts with contract-related WebMCP calls (e.g., `acp_createSession`), followed by CDP verification steps (`cdp-wait`, `cdp-evaluate`)
3. **Then** lists observable outcomes that match the contract's promised behavior
4. Use `data-testid` attributes from the cdp-verification-scenarios skill's reference table for CDP steps
5. Reference the scenario format from `cdp-verification-scenarios` skill — use `## Given` / `## When` / `## Then` heading style consistently
