# ACP pool task 3 report

## RED/GREEN evidence

- RED: `yarn jest packages/ai-native/__test__/node/acp-agent.service.test.ts --runInBand` failed the two saturation seams because the public error name was `AcpThreadPoolSaturatedError`, rather than `ACP_THREAD_POOL_SATURATED`. The pre-existing retained-reference disposal test also failed, as documented in the task brief.
- GREEN: `yarn jest packages/ai-native/__test__/node/acp-agent.service.test.ts --runInBand --testNamePattern='gives one foreground request exclusive ownership|should preserve working sessions and report diagnostics'` passed both saturation paths.
- RED: the browser provider test received node diagnostic text for a revived `ACP_THREAD_POOL_SATURATED` error.
- GREEN: the combined browser command passed 78 tests, covering the mapped actionable message, unchanged unrelated error, no direct provider notification, and the presentation loading/active-session/draft regression.

## Verification

- `yarn jest packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand --selectProjects jsdom`
- `yarn tsc --build configs/ts/references/tsconfig.core-common.json --pretty false`
- `yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false`
- `yarn prettier --check` for all task files; `git diff --check`

## Scoped changes and staging

- Shared runtime-neutral `ACP_THREAD_POOL_SATURATED_ERROR_NAME` in `agent-types.ts`, used by the node ACP service.
- Browser provider maps only the revived error name through `localize`, rethrows it, and no longer directly notifies in `createSession`.
- Tests cover node public saturation, browser provider mapping and preservation of unrelated errors, plus presentation behavior.
- Existing `cancelSession` and other unrelated dirty hunks are intentionally excluded from staging.

## Self-review and concerns

- The browser mapping exposes only a parsed numeric limit, never node diagnostic wording; it uses the actionable localized fallback when the serialized message is missing or changes shape.
- The full node test file still has the approved unrelated retained-reference failure; targeted saturation tests pass.

## Review-fix evidence

- RED: the provider test expected the revived `ACP_THREAD_POOL_SATURATED` name and a limit-aware message for `Thread pool is full (3)`; the mapped browser Error instead had the default `Error` name and omitted the limit. The no-limit fallback test failed for the same lost name.
- GREEN: the provider maps a parseable numeric limit into localized actionable text, preserves `ACP_THREAD_POOL_SATURATED` on the mapped Error, and retains the localized fallback when no number can be recovered. The unrelated named startup error is rethrown as the identical object.
- Verification: the paired browser command passed 79 tests; both `core-common` and `ai-native` TypeScript references passed; Prettier and `git diff --check` passed.

## Review-fix concern

- Limit extraction accepts only the numeric capacity from the known node message shape. No node diagnostics (including LRU wording) are exposed, and the actionable localized fallback remains available if the serialized message changes.
