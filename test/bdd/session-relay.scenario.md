# Scenario: Session Relay - Digest Preview, Permission Gate, and Bounded Reads

**Trigger:** `packages/ai-native/src/browser/acp/acp-chat-relay-*.ts` or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `mcp-contract` **Required profile:** `full` **Fixtures:** Two ACP sessions from the mock ACP agent `--fixture=history` with bounded history or deterministic sends, prepared relay digest state, or live sessions created through a real LLM-backed ACP agent only for bounded relay smoke coverage; stable permission dialog selectors are required when posting the relay. **Workspace mutation:** None. **Automation status:** Automated through MCP plus Chrome DevTools MCP; live-agent sessions may supply bounded metadata, but the mock `history` fixture or equivalent stable setup is required for prepared relay digest and permission-gate hardening.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- The scenario is scheduled only when `ai.native.webmcp.profile = "full"`.
- ACP Chat relay and bounded debug read tools are exposed by the full profile.
- There are at least two ACP sessions, preferably seeded by the mock `history` fixture:
  - `sourceSessionId`
  - `targetSessionId`
- The relay post and bounded debug read steps run in the same full-profile pass.

## When

### Part A - Discover Sessions

1. `mcp`: `acp_chat_list_sessions({})` -> record `SESSIONS`.

### Part B - Prepare Digest

2. `mcp`: `acp_chat_prepare_session_digest({ sourceSessionId, maxSourceChars: 12000, maxDigestChars: 2000 })` -> record `DIGEST`.

### Part C - Post Digest With Permission

3. Start:
   ```js
   acp_chat_post_prepared_relay({ digestId: DIGEST.result.digestId, targetSessionId });
   ```
4. `chrome-devtools-mcp-wait`: wait until the permission dialog is visible.
5. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_DURING_RELAY`.
6. `chrome-devtools-mcp`: click the visible Reject or close control in the permission dialog.
7. Await the relay tool call -> record `POST_RESULT`.

### Part D - Bounded Debug Read

8. If `acp_chat_read_session_messages` is exposed in the full profile, call:
   ```js
   acp_chat_read_session_messages({ sessionId: sourceSessionId, maxMessages: 10, maxChars: 4000 });
   ```
   -> record `READ_RESULT`.

## Then

- Step 1 returns `success: true` with `sessions` metadata and `total`.
- Session metadata may include bounded title fields, but must not include full prompt/message bodies, assistant response content, or tool-call result content.
- Step 2 returns `success: true`.
- `DIGEST.result` contains:
  - `digestId`
  - `sourceSessionId`
  - `sourceTitle`
  - `digestSource`
  - `preview`
  - `digestChars`
  - `sourceChars`
  - `sourceTruncated`
  - `expiresAt`
- `DIGEST.result` must not include a full `digest` field.
- `DIGEST.result.preview.length <= 300`.
- If Part C runs, Step 4 shows a permission dialog before relay posting completes.
- If Part C runs, Step 5 observes `activeDialogCount >= 1`.
- If Part C is rejected, Step 7 returns `success: false` and `error: "PERMISSION_DENIED"`.
- If Part C is allowed in a separate run, the response must include `posted`, `digestId`, `sourceSessionId`, `targetSessionId`, `digestChars`, and `switchedSession`.
- If Part D runs, `READ_RESULT.result.messages` contains only `user` and `assistant` roles, bounded by `maxMessages` and `maxChars`.
- Part D must not return tool-result messages.

## Live Agent Execution

- A real LLM-backed ACP agent may create source and target sessions for relay smoke coverage, list metadata, bounded digest preview shape, and permission-gate observability.
- Live-agent mode must not assert full digest bodies, exact generated session titles, assistant response text, model tool results, or exact message contents. Permission posting still requires a stable visible Reject/close selector, and bounded debug reads must remain redacted evidence only.

## Pass / Fail Judgment

- **PASS** - relay preparation returns only bounded metadata/preview, relay posting is permission-gated, and full-profile message reads are bounded.
- **BLOCKED** - the run is not full profile, lacks two ACP sessions from the mock `history` fixture or equivalent stable setup, or lacks a stable permission dialog selector for the Reject/close control.
- **FAIL** - prepare returns full digest/source content, post bypasses permission, or debug reads return unbounded/tool-result content.
