# Scenario: Agent Session History Restore After Backend Session Release

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic ACP agent runs with `--fixture=history`; an Agent Session is completed, the Playwright-only E2E hook releases Browser-owned ACP sessions, the fixture continues returning the durable Session from `session/list` and replays bounded history through `session/load`, and the loopback-only `acpBddAttachmentFailure=reject-once` switch rejects the first live attachment attempt after history restoration. **Workspace mutation:** Temporary Playwright workspace only. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-history-restore-after-session-release.test.ts`.

## Steps

1. Open Agentic Layout with the deterministic history fixture.
2. Create Session A, submit a prompt, and wait for its completed deterministic response and Agent Session Browser row.
3. Release the Browser-owned ACP sessions through the E2E-only cleanup hook, clear transient active/pending state, and reload the same IDE page.
4. Confirm that the Agent still returns Session A and it remains in the Agent Session Browser without any local Task fallback.
5. Create Session B and wait until it is active.
6. Select Session A.
7. Select Session A once more to verify later attachment attempts remain retryable.

## Expected

- Releasing the runtime session does not remove Agent-returned Session A from the Agent Session Browser.
- Selecting Session A restores its bounded Agent history before the live attachment is established.
- Session A becomes active and Session B stops being active.
- The restored conversation shows the deterministic replay user and assistant rows with no stale loading state.
- The notification area remains free of legacy Task-history fallback messages.
- Selecting Session A again keeps it active and does not reload, duplicate, or erase the restored history.
- No raw ACP payload, stack trace, command, environment value, or credential is rendered.

## Pass / Fail Judgment

- **PASS** - the released Session is rediscovered, restored, and activated through its originating ACP Agent even when live attachment initially fails.
- **FAIL** - the previous Session remains active, Session A cannot become active, restored history is absent/duplicated, or a legacy fallback is displayed.
- **BLOCKED** - the deterministic history fixture, E2E session-release hook, interactive profile, or stable Session selectors are unavailable.
