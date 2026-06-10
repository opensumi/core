// Source: test/bdd/acp-chat-agentic-side-entry-filter.scenario.md

import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';
import { createBddEvidence } from './utils/bdd-evidence';

let app: OpenSumiApp;

const STANDARD_LEFT_CONTAINER_IDS = ['explorer', 'search', 'scm', 'debug', 'extension'];

async function showAcpChatIfAvailable() {
  await page
    .waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, { timeout: 15_000 })
    .catch(() => undefined);

  await page
    .evaluate(async () => {
      const modelContext = (navigator as any).modelContext;
      if (!modelContext?.executeTool) {
        return;
      }
      const tools = await modelContext.getTools?.();
      if (!Array.isArray(tools) || tools.some((tool: { name: string }) => tool.name === 'acp_chat_show_chat_view')) {
        await modelContext.executeTool('acp_chat_show_chat_view', {});
      }
    })
    .catch(() => undefined);
}

async function switchPanelLayout(mode: 'Agentic' | 'Classic') {
  const layoutLabel = page.getByText(/^(Agentic|Classic)$/).first();
  await expect(layoutLabel).toBeVisible();
  if ((await layoutLabel.textContent())?.trim() === mode) {
    return;
  }
  await layoutLabel.click();
  await page.getByText(mode, { exact: true }).last().click();
  await expect(page.getByText(mode, { exact: true }).first()).toBeVisible();
}

async function getVisibleStandardSideEntries(): Promise<string[]> {
  return page.evaluate((standardIds) => {
    const leftTabbar = document.querySelector('#opensumi-left-tabbar');
    if (!leftTabbar) {
      return [];
    }

    return Array.from(leftTabbar.querySelectorAll('li[id]'))
      .map((entry) => entry.id)
      .filter((id) => standardIds.includes(id));
  }, STANDARD_LEFT_CONTAINER_IDS);
}

async function clickSideEntry(containerId: string) {
  await page.locator(`#opensumi-left-tabbar li#${containerId}`).click();
}

test.describe('ACP Chat Agentic side entry filter', () => {
  test.beforeAll(async () => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    const workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('shows only Explorer and Git side entries in Agentic layout', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-side-entry-filter', {
      sourceScenario: 'test/bdd/acp-chat-agentic-side-entry-filter.scenario.md',
      profile: 'default',
      executionMode: 'deterministic-ui',
      hardeningVerdict: 'CONVERT',
    });

    await showAcpChatIfAvailable();
    await switchPanelLayout('Agentic');

    await expect(page.getByText('Agentic', { exact: true }).first()).toBeVisible();
    const agenticEntries = await getVisibleStandardSideEntries();
    const agenticProof = await evidence.saveJson(
      '01-agentic-side-entries',
      { entries: agenticEntries },
      'Agentic left side entries',
    );

    expect(agenticEntries).toEqual(['explorer', 'scm']);

    await clickSideEntry('scm');
    await expect(page.locator('#opensumi-left-tabbar li#scm')).toHaveClass(/active/);

    await clickSideEntry('explorer');
    await expect(page.getByRole('heading', { name: 'EXPLORER' })).toBeVisible();

    await switchPanelLayout('Classic');
    const classicEntries = await getVisibleStandardSideEntries();
    const classicProof = await evidence.saveJson(
      '02-classic-side-entries',
      { entries: classicEntries },
      'Classic left side entries',
    );

    expect(classicEntries).toEqual(expect.arrayContaining(['explorer', 'search', 'scm', 'debug', 'extension']));

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Agentic side entries show only Explorer and Git/SCM.',
      status: 'pass',
      evidence: [agenticProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Explorer and Git/SCM entries remain interactive in Agentic layout.',
      status: 'pass',
      evidence: [agenticProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Classic layout keeps the broader standard Activity Bar entries.',
      status: 'pass',
      evidence: [classicProof].filter(Boolean) as string[],
    });

    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
      },
    });
  });
});
