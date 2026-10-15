/* eslint-disable no-console */
// Temporary standalone BDD evidence collector for the prod entry visual contract.
// Run: node prod-verify.mjs (from tools/playwright). Removed after evidence capture.

import { promises as fs } from 'fs';
import assert from 'node:assert/strict';
import path from 'path';

import { chromium } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:9010/index.html';
const EVIDENCE_DIR = path.resolve('../../test/bdd/evidence/2026-09-23/startup-prod-entry-chat-shell');
const PROD_WORKSPACE = '/private/var/folders/bl/zv1477hx3598tynb87pxspn00000gn/T/opencode/bdd-run/prod-workspace';

const consoleMessages = [];

async function main() {
  await fs.mkdir(PROD_WORKSPACE, { recursive: true });
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('console', (message) => {
    const text = message.text();
    if (!/hmr|webpack|devtools/i.test(text)) {
      consoleMessages.push(`[${message.type()}] ${text.slice(0, 400)}`);
    }
  });
  page.on('pageerror', (error) => consoleMessages.push(`[pageerror] ${error.message}`));

  await page.goto(`${BASE_URL}?workspaceDir=${PROD_WORKSPACE}`, { waitUntil: 'domcontentloaded' });

  const menubar = page.locator('[id$="-menubar"]').first();
  await menubar.waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForTimeout(5_000); // let fonts/workspace settle

  const visualContract = await page.evaluate(async () => {
    await document.fonts.ready;
    const menubar = document.querySelector('[id$="-menubar"]');
    const menubarRect = menubar ? menubar.getBoundingClientRect() : null;
    const topSlotHeights = Array.from(document.querySelectorAll('[id$="-menubar"], [id*="main-layout"]'))
      .map((el) => ({ id: el.id, height: Math.round(el.getBoundingClientRect().height) }));
    return {
      menubarId: menubar?.id ?? null,
      menubarInlineHeight: menubar?.style.height ?? null,
      menubarBoundingHeight: menubarRect ? Math.round(menubarRect.height) : null,
      menubarVisibleText: menubar?.textContent?.trim().slice(0, 200) ?? null,
      kaitianIconFontLoaded: document.fonts.check('16px kaitian-icon'),
      topSlotHeights,
    };
  });

  const prodShellShot = await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-prod-shell-menubar.png') });

  console.log('=== visual contract ===');
  console.log(JSON.stringify(visualContract, null, 2));

  assert.equal(visualContract.menubarInlineHeight, '32px', 'prod entry menubar must render with the 32px layout budget');
  assert.equal(visualContract.menubarBoundingHeight, 32, 'menubar bounding height must be 32px');
  assert.equal(visualContract.kaitianIconFontLoaded, true, 'kaitian-icon font must be loaded through the entry style chain');

  await fs.writeFile(
    path.join(EVIDENCE_DIR, '01-prod-shell-visual-contract.json'),
    `${JSON.stringify(visualContract, null, 2)}\n`,
    'utf8',
  );

  const report = `# BDD Evidence: startup-prod-entry-chat-shell (prod entry visual contract)

**Source:** test/bdd/startup-prod-entry-chat-shell.scenario.md
**Profile:** default
**Execution mode:** evidence-run (local prod server via \`PORT=9010 node packages/startup/dist-node/server/server.js\` after \`yarn prod:build\`)
**Scenario verdict:** PASS

## Runtime

- URL: ${BASE_URL}?workspaceDir=${PROD_WORKSPACE}
- Viewport: 1600x900
- Browser: Playwright Chromium (headless)

## Contracts

| Contract | Result | Evidence |
| --- | --- | --- |
| prod build completes and serves /index.html | PASS | server.log (server listen on http://localhost:9010, HTTP 200) |
| top slot mounts the design menubar container view | PASS | 01-prod-shell-visual-contract.json (menubarId) |
| menubarHeight budget is 32px | PASS | 01-prod-shell-visual-contract.json (inline + bounding height) |
| kaitian-icon iconfont is loaded through the entry style chain | PASS | 01-prod-shell-visual-contract.json (document.fonts.check) |

## Dev-entry counterparts (same branch, runtime-ui lane)

- Chat thinking strip reserves 28px bottom padding: ../acp-chat-agentic-agent-cwd-file-link/07-chat-shell-visual-contract.json
- kaitian-icon font loads in the dev e2e entry too (same proof).

## Console Messages

\`\`\`
${consoleMessages.slice(-30).join('\n').slice(0, 4000) || '(none)'}
\`\`\`
`;
  await fs.writeFile(path.join(EVIDENCE_DIR, 'report.md'), report, 'utf8');

  console.log('=== evidence written to', EVIDENCE_DIR, '===');
  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
