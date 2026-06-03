# ACP WebMCP Issue: Bounded Diagnostic Results

## Category

WebMCP safe result serialization.

## Evidence

- Runtime: `yarn start`
- Browser surface: `navigator.modelContext`
- Tool catalog size: `29`
- Legacy `_opensumi/...` names: `0`

Successful read-only calls:

- `acp_chat_showChatView({})`
- `acp_chat_getSessionState({})`
- `acp_chat_getPermissionState({})`
- `workspace_getInfo({})`
- `editor_getActive({})`
- `workspace_listOpenFiles({})`
- `editor_listOpenFiles({})`

Problematic calls:

- `diagnostics_getStats({})`
- `diagnostics_list({})`

The returned diagnostics payload includes internal object graphs such as `_manager`, `disposables`, `_stats`, and circular references. A direct JSON serialization attempt failed with `Converting circular structure to JSON`.

## Result

FAIL. Diagnostics WebMCP calls can return unbounded/internal circular structures instead of a bounded, safe result.

## Review Notes

- The public result should include plain diagnostic entries and compact stats only.
- Internal manager objects and subscriptions should not be exposed through WebMCP.
- This is separate from tool naming; canonical underscore names were exposed correctly and no legacy names appeared.

## Root Cause

`diagnostics_getStats` and `diagnostics_list` returned `markerService.getManager().getStats()` directly. That value is a `MarkerStats` instance with internal manager/subscription references, including circular object graphs.

## Fix

- Updated `packages/ai-native/src/browser/acp/webmcp-groups/diagnostics.webmcp-group.ts` to map stats to a plain bounded object:
  - `errors`
  - `warnings`
  - `infos`
  - `unknowns`
- Added `packages/ai-native/__test__/browser/webmcp-diagnostics-group.test.ts` to verify both diagnostics tools return JSON-serializable results without internal fields.

## Verification

- `yarn jest packages/ai-native/__test__/browser/webmcp-diagnostics-group.test.ts --runInBand`
- Runtime WebMCP recheck:
  - `diagnostics_getStats({})` returned `{"errors":0,"warnings":0,"infos":0,"unknowns":0}`
  - `diagnostics_list({})` returned `diagnostics: []`, bounded stats, `total: 0`, `truncated: false`
  - `JSON.stringify` succeeded for both returned tool results.

Status: fixed.
