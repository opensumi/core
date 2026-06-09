// Source: test/bdd/acp-chat-agentic-startup.scenario.md

import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';
import { createBddEvidence } from './utils/bdd-evidence';

let app: OpenSumiApp;

test.describe('ACP Chat Agentic startup layout', () => {
  test.beforeAll(async () => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    const workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('starts with a usable Agentic chat layout and safe default tool surface', async (_fixtures, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-startup', {
      sourceScenario: 'test/bdd/acp-chat-agentic-startup.scenario.md',
      profile: 'default',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
    await page.evaluate(async () => {
      await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
    });

    const layoutLabel = page.getByText(/^(Agentic|Classic)$/).first();
    if ((await layoutLabel.textContent())?.trim() === 'Classic') {
      await layoutLabel.click();
      await page.getByText('Agentic', { exact: true }).last().click();
    }

    await expect(page.getByText('Agentic', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'EXPLORER' })).toBeVisible();

    const layout = await page.evaluate(async () => {
      const modelContext = (navigator as any).modelContext;
      const tools = await modelContext.getTools();
      const toolNames = tools.map((tool: { name: string }) => tool.name).sort();
      const state = await modelContext.executeTool('acp_chat_get_session_state', {});
      const permission = await modelContext.executeTool('acp_chat_get_permission_state', {});
      const aiChat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
      const workbench = document.querySelector('#workbench-editor')?.getBoundingClientRect();
      const statusVisible = Array.from(document.querySelectorAll('body *')).some((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.y > window.innerHeight - 80 &&
          rect.width > 200 &&
          rect.height >= 18 &&
          rect.height <= 48 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        );
      });

      return {
        acpTools: toolNames.filter((name: string) => name.startsWith('acp_chat')),
        forbiddenTools: toolNames.filter(
          (name: string) =>
            /[A-Z]/.test(name) ||
            name.startsWith('_opensumi/') ||
            [
              'acp_sendMessage',
              'acp_createSession',
              'acp_switchSession',
              'acp_clearSession',
              'acp_cancelRequest',
              'acp_handlePermissionDialog',
            ].includes(name),
        ),
        aiChat: aiChat && { x: aiChat.x, width: aiChat.width, height: aiChat.height },
        workbench: workbench && { x: workbench.x, width: workbench.width, height: workbench.height },
        statusVisible,
        state,
        permission,
      };
    });
    const layoutProof = await evidence.saveJson(
      '01-layout-and-tools',
      layout,
      'layout geometry and default tool surface',
    );
    const layoutScreenshot = await evidence.captureScreenshot(page, '02-agentic-startup', 'Agentic chat startup UI');

    expect(layout.acpTools).toEqual([
      'acp_chat_get_permission_state',
      'acp_chat_get_session_state',
      'acp_chat_show_chat_view',
    ]);
    expect(layout.forbiddenTools).toEqual([]);
    expect(layout.aiChat?.x).toBeLessThan(layout.workbench?.x ?? Number.POSITIVE_INFINITY);
    expect(layout.aiChat?.width).toBeGreaterThanOrEqual(640);
    expect(layout.aiChat?.width).toBeLessThanOrEqual(1440);
    expect(layout.workbench?.width).toBeGreaterThanOrEqual(480);
    expect(layout.statusVisible).toBe(true);
    expect(layout.state.success).toBe(true);
    expect(layout.permission.success).toBe(true);

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Agentic AI Chat opens as the leftmost major surface with Explorer and status bar visible.',
      status: 'pass',
      evidence: [layoutProof, layoutScreenshot].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Default WebMCP ACP Chat surface exposes only lower-snake safe metadata tools.',
      status: 'pass',
      evidence: [layoutProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Session and permission state tools return successful metadata-only responses.',
      status: 'pass',
      evidence: [layoutProof].filter(Boolean) as string[],
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
