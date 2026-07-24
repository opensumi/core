# Scenario: Agentic Task Session Recovery

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic ACP agent runs with `--fixture=task-session-missing`, completes one Task Conversation, exits, and returns ACP `Resource not found` when the retained Task is selected after reload. **Workspace mutation:** Temporary Playwright workspace only. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-task-session-recovery.test.ts`.

## Steps

1. Open Agentic Layout with the deterministic fixture and submit the first prompt for a new Agent Task.
2. Wait for the Task Row and completed response, then allow the fixture process to exit.
3. Reload the same Web IDE page after clearing only transient active/pending Task state.
4. Select the retained Task Row.
5. Select the same Task Row again.

## Expected

- The retained Task remains visible after reload and shows its originating ACP Agent identity.
- The first failed selection does not select a blank Task or replace the previous Active Task.
- ACP `session/load` error `-32002` renders `History unavailable` on that Task Row.
- Selecting the same Task Row again retries activation and keeps the same row-level condition when the Session remains unavailable.
- No stack trace, raw ACP payload, command, environment value, or credential is rendered.
