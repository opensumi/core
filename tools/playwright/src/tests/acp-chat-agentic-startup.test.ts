// Source: test/bdd/acp-chat-agentic-startup.scenario.md

import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';
import {
  aiNativeWorkbenchUrl,
  ensureAgenticLayout,
  waitForAcpChatReady,
  waitForExplorerViewVisible,
  waitForWorkbenchReady,
  writeAiNativePanelLayoutSettings,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

let app: OpenSumiApp;
let workspace: OpenSumiWorkspace;

test.describe('ACP Chat Agentic startup layout', () => {
  test.beforeAll(async () => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    await workspace.initWorksapce();
    await writeAiNativePanelLayoutSettings(workspace.workspace.codeUri.fsPath, 'agentic');
    app = new OpenSumiApp(page);
    await page.goto(aiNativeWorkbenchUrl(workspace.workspace.codeUri.fsPath));
    await waitForWorkbenchReady(page);
  });

  test.afterAll(() => {
    app.dispose();
    workspace.dispose();
  });

  test('starts with a usable Agentic chat layout and safe default tool surface', async ({
    browser: _browser,
  }, testInfo) => {
    void _browser;
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

    await waitForAcpChatReady(page);
    await expect(page.locator('.AI-Chat-slot')).not.toContainText('Initializing ACP service');

    const initialLayout = await page.evaluate(async () => {
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
        viewportWidth: window.innerWidth,
        statusVisible,
        state,
        permission,
      };
    });

    const maximizeAction = page.locator('#agentic-chat-panel-header-maximize [role="button"]');
    await expect(maximizeAction).toHaveAttribute('aria-label', 'Focus AI Chat');
    await maximizeAction.click();
    await expect(maximizeAction).toHaveAttribute('aria-label', 'Restore editor and Explorer');
    const focusedLayout = await page.evaluate(() => {
      const aiChat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
      const workbench = document.querySelector('#workbench-editor')?.getBoundingClientRect();
      return {
        aiChat: aiChat && { x: aiChat.x, width: aiChat.width, height: aiChat.height },
        workbench: workbench && { x: workbench.x, width: workbench.width, height: workbench.height },
      };
    });

    await maximizeAction.click();
    await expect(maximizeAction).toHaveAttribute('aria-label', 'Focus AI Chat');
    await ensureAgenticLayout(page);
    await waitForExplorerViewVisible(page);
    const restoredLayout = await page.evaluate(() => {
      const aiChat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
      const workbench = document.querySelector('#workbench-editor')?.getBoundingClientRect();
      return {
        aiChat: aiChat && { x: aiChat.x, width: aiChat.width, height: aiChat.height },
        workbench: workbench && { x: workbench.x, width: workbench.width, height: workbench.height },
      };
    });
    const layoutProof = await evidence.saveJson(
      '01-layout-and-tools',
      { initialLayout, focusedLayout, restoredLayout },
      'default split geometry, focused chat geometry, restored workbench geometry, and default tool surface',
    );
    const layoutScreenshot = await evidence.captureScreenshot(page, '02-agentic-startup', 'Agentic chat startup UI');

    expect(initialLayout.acpTools).toEqual([
      'acp_chat_get_permission_state',
      'acp_chat_get_session_state',
      'acp_chat_show_chat_view',
    ]);
    expect(initialLayout.forbiddenTools).toEqual([]);
    expect(initialLayout.aiChat?.x).toBeLessThan(initialLayout.workbench?.x ?? Number.POSITIVE_INFINITY);
    expect(initialLayout.aiChat?.width).toBeGreaterThanOrEqual(640);
    expect(initialLayout.aiChat?.width).toBeLessThanOrEqual(1440);
    expect(initialLayout.workbench?.width).toBeGreaterThanOrEqual(480);
    expect(initialLayout.statusVisible).toBe(true);
    expect(initialLayout.state.success).toBe(true);
    expect(initialLayout.permission.success).toBe(true);
    expect(focusedLayout.aiChat?.width).toBeGreaterThanOrEqual(initialLayout.viewportWidth - 2);
    expect(focusedLayout.aiChat?.width).toBeLessThanOrEqual(initialLayout.viewportWidth + 2);
    expect(focusedLayout.workbench).toBeUndefined();
    expect(restoredLayout.aiChat?.x).toBeLessThan(restoredLayout.workbench?.x ?? Number.POSITIVE_INFINITY);
    expect(restoredLayout.aiChat?.width).toBeGreaterThanOrEqual(640);
    expect(restoredLayout.aiChat?.width).toBeLessThanOrEqual(1440);
    expect(restoredLayout.workbench?.width).toBeGreaterThanOrEqual(480);

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Agentic AI Chat starts beside the workbench and supports a reversible full-screen focus mode.',
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
