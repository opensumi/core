# Scenario: ACP Chat Request Acceptance and Session Route Preservation

**Trigger:** `packages/ai-native/src/browser/chat/acp-chat-agent.ts` or `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** A custom slash-command handler that completes without opening an ACP stream, plus an Agent Session metadata model with a captured `{agentId, cwd}` route and a replacement `session/load` snapshot that omits runtime-only extension metadata. **Workspace mutation:** None. **Automation status:** Automated by focused Jest suites in `packages/ai-native/__test__/browser/chat/acp-chat-agent.test.ts` and `packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts`.

## Given

- An ACP Chat request selects a registered custom slash command whose handler owns request execution.
- A discovered Agent Session has a captured ACP Target containing its Agent identity and Workspace Target.
- The Agent later returns a transcript snapshot without the browser-only ACP Target metadata.

## When

1. Submit the custom slash command and allow its handler to complete normally.
2. Load the discovered Agent Session so the transcript snapshot replaces its metadata-only browser model.
3. Continue the replaced Session through the normal ACP request-routing path.

## Then

- The custom slash-command request emits `requestAccepted` before the handler starts.
- Normal handler completion does not fail with `ACP request ended before it was accepted` and does not open an ACP prompt stream.
- Replacing the Session model preserves the existing `{agentId, cwd}` ACP Target when the snapshot omits it.
- The first continued request resolves configuration for the preserved Workspace Target, so Agent Session discovery refresh can complete for the original directory.
