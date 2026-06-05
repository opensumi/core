# Scenario: Session Relay - Digest Preview, Permission Gate, and Bounded Reads

**Trigger:** `packages/ai-native/src/browser/acp/acp-chat-relay-*.ts` or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- `opensumi_enableCapabilityGroup({ group: "acp_chat" })` has succeeded.
- There are at least two ACP sessions:
  - `sourceSessionId`
  - `targetSessionId`
- The relay post step runs only when `ai.native.webmcp.profile = "full"`.
- The bounded debug read step may run in the current default profile after enabling `acp_chat`, because `acp_chat_readSessionMessages` is a read tool.

## When

### Part A - Discover Sessions

1. `mcp`: `acp_chat_listSessions({})` -> record `SESSIONS`.

### Part B - Prepare Digest

2. `mcp`: `acp_chat_prepareSessionDigest({ sourceSessionId, maxSourceChars: 12000, maxDigestChars: 2000 })` -> record `DIGEST`.

### Part C - Post Digest With Permission

3. In full profile, start:
   ```js
   acp_chat_postPreparedRelay({ digestId: DIGEST.result.digestId, targetSessionId });
   ```
4. `chrome-devtools-mcp-wait`: wait until the permission dialog is visible.
5. `mcp`: `acp_chat_getPermissionState({})` -> record `PERMISSION_DURING_RELAY`.
6. Manually reject or close the permission dialog through the UI.
7. Await the relay tool call -> record `POST_RESULT`.

### Part D - Bounded Debug Read

8. If `acp_chat_readSessionMessages` is exposed after enabling `acp_chat`, call:
   ```js
   acp_chat_readSessionMessages({ sessionId: sourceSessionId, maxMessages: 10, maxChars: 4000 });
   ```
   -> record `READ_RESULT`.

## Then

- Step 1 returns `success: true` with `sessions` metadata and `total`.
- Session metadata must not include prompt text, assistant response content, or tool-call result content.
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

## Pass / Fail Judgment

- **PASS** - relay preparation returns only bounded metadata/preview, relay posting is permission-gated, and full-profile message reads are bounded.
- **PARTIAL** - Parts A and B pass, but full-profile Part C is skipped because the environment is not full profile or lacks two sessions.
- **FAIL** - prepare returns full digest/source content, post bypasses permission, or debug reads return unbounded/tool-result content.
