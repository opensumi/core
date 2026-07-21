# Scenario: Agentic Task History Restore After Backend Session Release

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic ACP agent runs with `--fixture=history`; an initial Agent Task is completed, the Playwright-only E2E hook releases Browser-owned ACP sessions, the fixture recreates the released durable Session with bounded replay updates, and the loopback-only `acpBddAttachmentFailure=reject-once` switch rejects the first live attachment attempt after history restoration. **Workspace mutation:** Temporary Playwright workspace only. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-history-restore-after-session-release.test.ts`.

## Steps

1. Open Agentic Layout with the deterministic history fixture.
2. Launch Task A, submit a prompt, and wait for its completed deterministic response and Task Row.
3. Release the Browser-owned ACP sessions through the E2E-only cleanup hook, clear transient active/pending Task state, and reload the same IDE page.
4. Confirm that Task A remains in the Agent Task List.
5. Launch Task B and wait until it is the Active Task.
6. Select retained Task A.
7. Select Task A once more to verify later attachment attempts remain retryable.

## Expected

- Releasing the runtime session does not remove retained Task A from the Agent Task List.
- Selecting Task A restores its bounded persisted history before the live attachment is established.
- Task A becomes the Active Task and Task B stops being active.
- The restored conversation shows the deterministic replay user and assistant rows with no stale loading state.
- The notification area does not show `Unable to open this task history. The previous Task remains active.`
- Selecting Task A again keeps it active and does not reload, duplicate, or erase the restored history.
- No raw ACP payload, stack trace, command, environment value, or credential is rendered.

## Pass / Fail Judgment

- **PASS** - the released Task Session is restored and activated through its originating ACP Agent without the generic history-load fallback.
- **FAIL** - the previous Task remains active, Task A cannot become active, restored history is absent/duplicated, or the generic fallback is displayed.
- **BLOCKED** - the deterministic history fixture, E2E session-release hook, interactive profile, or stable Task selectors are unavailable.
