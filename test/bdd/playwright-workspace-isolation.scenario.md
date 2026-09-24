# Scenario: Playwright Temporary Workspace Isolation and Cleanup

**Trigger:** `tools/playwright/src/workspace.ts`, `tools/playwright/src/tests/utils/acp-bdd-fixture.ts`, or `tools/playwright/scripts/cleanup-legacy-temp-directories.js`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** A temporary filesystem root, multiple `OpenSumiWorkspace` instances, per-workspace preference directories, and directories matching or not matching the legacy Playwright workspace naming scheme. **Workspace mutation:** Temporary fixture directories only; all are removed before the scenario ends. **Automation status:** Converted to `tools/playwright/src/tests/workspace.test.ts` and `tools/playwright/src/tests/cleanup-legacy-temp-directories.test.ts`.

## Given

- Playwright owns one explicit temporary root for generated workspaces and user-preference directories.
- The cleanup command defaults to preview mode.
- Legacy workspace cleanup recognizes only the historical generated-name pattern.

## When

1. Create two Playwright workspaces concurrently.
2. Write different settings into each workspace's preference directory.
3. Dispose the first workspace and continue using the second.
4. Dispose the second workspace.
5. Under a separate temporary cleanup root, create matching legacy directories and similarly named manual/output directories.
6. Run legacy cleanup in preview mode, then run it with deletion enabled.

## Then

- Workspace and preference directories are unique and located strictly under the Playwright temporary root.
- Disposing one workspace removes only its own workspace and preference directories.
- The remaining workspace and preferences are unaffected and usable until their own disposal.
- Final disposal removes all generated directories for that workspace.
- Preview mode reports matches without deleting anything.
- Delete mode removes only exact legacy generated-directory matches and preserves manual/output directories.
- No cleanup target is derived from an unresolved broad home/workspace path or unsafe recursive glob.

## Pass / Fail Judgment

- **PASS** - concurrent workspaces are isolated, disposal is ownership-scoped, and legacy cleanup is exact and preview-first.
- **FAIL** - workspaces share settings, disposal removes another run's data, generated directories leak, preview mutates files, or cleanup matches a non-legacy directory.
