// Source: test/bdd/acp-chat-agentic-layout-interop.scenario.md

import { expect } from '@playwright/test';

import { OpenSumiExplorerView } from '../explorer-view';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForExplorerViewVisible,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

let runtime: AcpBddFixtureRuntime;

async function openWorkspaceFile(path: string) {
  await waitForExplorerViewVisible(page);
  const explorer = await runtime.app.open(OpenSumiExplorerView);
  explorer.initFileTreeView(runtime.workspace.workspace.displayName);
  const waitForNode = async (nodePath: string) => {
    let node: Awaited<ReturnType<typeof explorer.getFileStatTreeNodeByPath>>;
    let attempts = 0;
    let refreshed = false;
    await expect
      .poll(
        async () => {
          attempts += 1;
          node = await explorer.getFileStatTreeNodeByPath(nodePath);
          if (!node && !refreshed && attempts >= 3) {
            refreshed = true;
            const refresh = await explorer.fileTreeView.getTitleActionByName('Refresh');
            await refresh?.click();
          }
          return Boolean(node);
        },
        { message: `Explorer 中缺少 ${nodePath}`, timeout: 30_000 },
      )
      .toBe(true);
    return node!;
  };
  if (path.includes('/')) {
    const parentPath = path.slice(0, path.lastIndexOf('/'));
    const parent = await waitForNode(parentPath);
    await parent.open();
    await page.keyboard.press('ArrowRight');
  }
  const node = await waitForNode(path);
  await node.open();
  await expect(page.getByText(path.split('/').pop()!, { exact: true }).last()).toBeVisible();
}

async function readOnlyToolProof() {
  return page.evaluate(async () => {
    const modelContext = (navigator as any).modelContext;
    const names = (await modelContext.getTools()).map((tool: { name: string }) => tool.name);
    const requested = [
      ['workspace_get_info', {}],
      ['editor_get_active', {}],
      ['workspace_list_open_files', {}],
      ['file_exists', { path: 'editor.js' }],
      ['file_read', { path: 'editor.js' }],
    ] as const;
    const results: Record<string, unknown> = {};
    for (const [name, args] of requested) {
      if (names.includes(name)) {
        const response = await modelContext.executeTool(name, args);
        results[name] = {
          success: response?.success === true,
          resultKeys: Object.keys(response?.result || {}),
        };
      }
    }
    return {
      available: requested.map(([name]) => name).filter((name) => names.includes(name)),
      results,
    };
  });
}

async function geometry() {
  return page.evaluate(() => {
    const chat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
    const workbench = document.querySelector('#workbench-editor')?.getBoundingClientRect();
    const explorer = Array.from(document.querySelectorAll('[data-viewlet-id="explorer"]'))
      .find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      ?.getBoundingClientRect();
    return {
      chat: chat && { x: chat.x, width: chat.width },
      workbench: workbench && { x: workbench.x, width: workbench.width },
      explorer: explorer && { x: explorer.x, width: explorer.width },
    };
  });
}

async function showChatAndWait() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
  await page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {}));
  await waitForAcpChatReady(page);
}

async function switchLayoutByMenu(target: 'Agent' | 'Classic') {
  await page.locator('#opensumi-menubar').getByText('View', { exact: true }).click();
  const panelLayout = page.getByText('Panel Layout', { exact: true }).last();
  await expect(panelLayout).toBeVisible();
  await panelLayout.hover();
  const targetLabel = page.getByText(target, { exact: true }).last();
  const targetItem = targetLabel.locator('xpath=ancestor::li[contains(@class,"kt-inner-menu-item")][1]');
  await expect(targetItem).toBeVisible();
  await targetItem.click();
}

test.describe('ACP Chat Agentic 布局互操作', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'interactive',
      panelLayout: 'agentic',
      writePanelLayoutPreference: false,
      delayMs: 20,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1800, height: 1000 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('打开文件、只读工具、重载和布局往返后仍保持可用', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-layout-interop', {
      sourceScenario: 'test/bdd/acp-chat-agentic-layout-interop.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });
    const originalUrl = page.url();

    await openWorkspaceFile('test/test.js');
    await openWorkspaceFile('editor.js');
    const toolsBefore = await readOnlyToolProof();
    expect(toolsBefore.available).toEqual(
      expect.arrayContaining([
        'workspace_get_info',
        'editor_get_active',
        'workspace_list_open_files',
        'file_exists',
        'file_read',
      ]),
    );
    expect(Object.values(toolsBefore.results).every((result: any) => result.success)).toBe(true);
    const initialGeometry = await geometry();
    expect(initialGeometry.chat?.x).toBeLessThan(initialGeometry.workbench?.x ?? Number.POSITIVE_INFINITY);
    expect(initialGeometry.chat?.width).toBeGreaterThanOrEqual(640);
    expect(initialGeometry.workbench?.width).toBeGreaterThanOrEqual(480);
    expect(initialGeometry.explorer?.width).toBeGreaterThan(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showChatAndWait();
    await ensureAgenticLayout(page);
    await waitForExplorerViewVisible(page);
    await expect(page.getByRole('textbox', { name: 'Agentic chat input' })).toBeVisible();
    const toolsAfterReload = await readOnlyToolProof();
    expect(Object.values(toolsAfterReload.results).every((result: any) => result.success)).toBe(true);
    const reloadedGeometry = await geometry();
    expect(reloadedGeometry.chat?.x).toBeLessThan(reloadedGeometry.workbench?.x ?? Number.POSITIVE_INFINITY);

    await switchLayoutByMenu('Classic');
    await page.waitForSelector('#main-horizontal-ai');
    await waitForExplorerViewVisible(page);
    await openWorkspaceFile('test/test.js');
    const toolsClassic = await readOnlyToolProof();
    expect(Object.values(toolsClassic.results).every((result: any) => result.success)).toBe(true);

    await switchLayoutByMenu('Agent');
    await page.waitForSelector('#main-horizontal-ai-agentic');
    await ensureAgenticLayout(page);
    await waitForExplorerViewVisible(page);
    await expect(page.getByRole('textbox', { name: 'Agentic chat input' })).toBeVisible();
    const toolsAgentRestored = await readOnlyToolProof();
    expect(Object.values(toolsAgentRestored.results).every((result: any) => result.success)).toBe(true);
    const restoredGeometry = await geometry();
    expect(restoredGeometry.chat?.x).toBeLessThan(restoredGeometry.workbench?.x ?? Number.POSITIVE_INFINITY);
    expect(page.url()).toBe(originalUrl);

    const proof = await evidence.saveJson(
      '01-layout-interop',
      {
        initialGeometry,
        reloadedGeometry,
        restoredGeometry,
        toolsBefore,
        toolsAfterReload,
        toolsClassic,
        toolsAgentRestored,
      },
      'Explorer/editor、只读 WebMCP、重载和 Agent/Classic 往返的互操作证据',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Agentic 中 Explorer/editor 可交互，workspace/editor/file 只读工具持续成功。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '重载与 Agentic→Classic→Agentic 往返不丢失 URL、输入、Explorer 或只读工具能力。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: runtime.fixture,
        profile: runtime.profile,
      },
    });
  });
});
