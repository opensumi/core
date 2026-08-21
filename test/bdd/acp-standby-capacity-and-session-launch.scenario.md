# Scenario: ACP Standby Capacity and Session Launch Commit Boundary

**Trigger:** `packages/ai-native/src/node/acp/acp-agent.service.ts`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/chat/acp-session-provider.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** A deterministic ACP process pool with controllable initialization, capacity, runtime configurations, Session creation, first-Prompt acceptance, cancellation, and failure promises; a browser Session Draft harness exposes editable Prompt/config state and loading/cancel UI state. **Workspace mutation:** None. **Automation status:** Automated by focused Jest coverage in `packages/ai-native/__test__/node/acp-agent.service.test.ts` and `packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts`; visible launch/cancel recovery is additionally covered by Agentic Playwright scenarios.

## Given

- The global ACP process-capacity limit is finite.
- Agentic Layout has one current Session Draft target `{agentId, cwd, runtime configuration}`.
- A Standby ACP Process is an initialized unbound process and never a pre-created durable Session.
- Foreground Session Launch has priority over standby reconciliation.

## When

### Part A - Latest Standby Target

1. Change the Draft Agent or Workspace Target several times within the debounce window.
2. Advance the debounce timer.
3. Submit the Draft before a later debounce completes.

### Part B - Claim and Replenish

4. Let a compatible Standby ACP Process finish initialization.
5. Launch a foreground Session using the same target.
6. Release sufficient process capacity after the Session claims the standby process.

### Part C - Genuine Saturation

7. Fill the process pool with non-reclaimable active Sessions.
8. Submit a new Session Draft.

### Part D - Cancel Before First-Prompt Acceptance

9. Pause Session creation or first-Prompt start before ACP accepts the Prompt.
10. Cancel the foreground launch.
11. Resolve the paused asynchronous work after cancellation.

### Part E - Failure Before and After Acceptance

12. Fail one launch before the first Prompt is accepted.
13. In a separate launch, accept the first Prompt and then fail the active request stream.

### Part F - Historical Selection

14. Rapidly select several historical Agent Sessions while standby reconciliation is active.
15. Allow superseded Session loads to settle in any order.

## Then

- Only the latest Draft target is declared; foreground submission flushes the latest target immediately.
- Project Addition alone does not start an ACP process or change the standby target.
- A compatible standby process is claimed without creating a duplicate process, and one replacement is reconciled only when capacity permits.
- Standby reconciliation never exceeds the configured global process limit and never evicts an active working Session.
- Genuine saturation fails without queuing, preserves the Draft configuration and unsent Prompt, and exposes actionable capacity guidance.
- Cancel before first-Prompt acceptance restores the editable Draft and focus, invalidates late results, and closes/releases any temporary Session.
- Failure before acceptance creates no Durable Agent Session, duplicate Task, or duplicate first Prompt.
- Failure after acceptance belongs to the now-durable Agent Session and does not roll it back into a Draft.
- Historical Session selection does not change the standby target; superseded loads release only their own references and cannot cancel Agent work.
- Repeated standby initialization failures back off and shutdown cancels unclaimed warmup cleanly.

## Pass / Fail Judgment

- **PASS** - standby capacity remains bounded and latest-target, foreground launch has priority, and cancellation/failure respect the first-Prompt commit boundary without orphan Sessions.
- **FAIL** - warmup expands capacity, stale targets win, active Sessions are evicted, saturation loses the Draft, cancellation commits late results, or pre-acceptance failures leave durable/duplicate Sessions.
