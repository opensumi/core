# Scenario: Startup Prod Entry Chat Shell Visual Contract

**Trigger:** `packages/startup/entry/web/prod/app.tsx`, `packages/startup/entry/styles.less`, `packages/ai-native/src/browser/components/components.module.less`, and the `prod:*`/`start:dev` npm scripts in the root `package.json`.

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** A prod server built with `yarn prod:build` and started with `PORT` (default 9000) via `yarn prod:start`; the entry serves `/index.html` with the menubar layout slot, the chat message action bar, and the kaitian-icon font. **Workspace mutation:** None. **Automation status:** Evidence run via a local prod server (`prod:build` + `PORT=<loopback port> prod:start`) plus Playwright screenshots; not converted to CI Playwright because the prod bundle is not part of the e2e runtime lane. The dev-entry padding/font assertions ride the existing `fixture=file-link-agent-cwd` and `file-link` runtime specs.

## Given

- The prod server is built from the current branch via `yarn prod:build` (this also verifies the `prod:clean`/`prod:build` scripts).
- The prod server is started on a loopback port via `yarn prod:start`/`cross-env PORT=<port> node packages/startup/dist-node/server/server.js`.
- The IDE page loads from `http://127.0.0.1:<port>/index.html` in a browser.

## When

1. Load the prod entry `/index.html` and wait for the workbench shell.
2. Inspect the top slot: `layoutViewSize.menubarHeight` is 32 and the top slot mounts the design menubar container view.
3. Inspect the chat message column padding: the reserved in-flow strip for the message action bar uses a 28px bottom padding (down from 52px).
4. Inspect icon fonts: `@opensumi/ide-components` kaitian-icon iconfont CSS is imported and the `kaitian-icon` font is available (`document.fonts.check`), so chat action icons (regenerate/copy/like/dislike) render glyphs instead of blanks.
5. Capture screenshots of the menubar area and a chat conversation area with visible action icons.

## Then

- The prod entry renders a visible menubar container in the top slot with a 32px height budget.
- The chat action bar strip reserves 28px so the session footer no longer shows an oversized blank band.
- The kaitian-icon font is loaded through the entry style chain and chat action icons render real glyphs.
- `prod:build` completes and `prod:start` serves `index.html` (script-level acceptance for the new npm scripts).

## Pass / Blocked Judgment

- **PASS** - the prod shell shows the menubar, fonts load, the padding strip measures 28px, and the prod scripts build/serve successfully.
- **BLOCKED** - the prod build fails, the port is unavailable, or the prod server cannot start.
- **FAIL** - the menubar slot is missing, icons render blank (font not loaded), the strip still reserves 52px, or `index.html` is not served.

## Codegen Plan

- Keep this as an evidence-run scenario with screenshots; convert to CI only if the prod server becomes a stable e2e runtime target.
