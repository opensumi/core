// Source: test/bdd/acp-chat-agentic-fallback.scenario.md

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

const FORBIDDEN_ACP_TOOLS = [
  'acp_sendMessage',
  'acp_createSession',
  'acp_switchSession',
  'acp_clearSession',
  'acp_cancelRequest',
  'acp_handlePermissionDialog',
  'acp_chat_getSessionState',
  'acp_chat_getPermissionState',
  'acp_chat_showChatView',
];

let app: OpenSumiApp;
let workspace: OpenSumiWorkspace;

test.describe('ACP Chat Agentic fallback', () => {
  test.beforeAll(async () => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    await workspace.initWorksapce();
    await writeAiNativePanelLayoutSettings(workspace.workspace.codeUri.fsPath, 'agentic');
    app = new OpenSumiApp(page);
    await page.goto(
      aiNativeWorkbenchUrl(workspace.workspace.codeUri.fsPath, 'default', 'agentic', {
        forceAcpBackendReadyFailure: true,
      }),
    );
    await waitForWorkbenchReady(page);
  });

  test.afterAll(() => {
    app.dispose();
    workspace.dispose();
  });

  test('renders a usable local fallback surface when ACP backend readiness rejects', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-fallback', {
      sourceScenario: 'test/bdd/acp-chat-agentic-fallback.scenario.md',
      profile: 'default',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
    const showResult = await page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {}));

    await ensureAgenticLayout(page);
    await waitForAcpChatReady(page);
    await expect(page.locator('.AI-Chat-slot')).not.toContainText('Initializing ACP service');
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
    await expect(page.locator('.AI-Chat-slot [contenteditable="true"]').last()).toBeVisible();
    await waitForExplorerViewVisible(page);

    const proof = await page.evaluate(async (forbiddenToolNames) => {
      const isVisible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const visibleText = Array.from(document.querySelectorAll('body *'))
        .filter(isVisible)
        .map((element) => element.textContent || '')
        .join('\n');
      const slot = document.querySelector('.AI-Chat-slot');
      const input = slot?.querySelector('[contenteditable="true"]');
      const inputRect = input?.getBoundingClientRect();
      const modelContext = (navigator as any).modelContext;
      const tools = await modelContext.getTools();
      const toolNames = tools.map((tool: { name: string }) => tool.name).sort();
      const sessionState = await modelContext.executeTool('acp_chat_get_session_state', {});
      const permissionState = await modelContext.executeTool('acp_chat_get_permission_state', {});

      return {
        acpTools: toolNames.filter((name: string) => name.startsWith('acp_chat')),
        forbiddenTools: toolNames.filter(
          (name: string) => forbiddenToolNames.includes(name) || name.startsWith('_opensumi/') || /[A-Z]/.test(name),
        ),
        inputVisible: Boolean(inputRect && inputRect.width > 0 && inputRect.height > 0),
        loadingVisible: visibleText.includes('Initializing ACP service'),
        fallbackSessionId: sessionState.result?.session?.sessionId,
        fallbackRawSessionId: sessionState.result?.session?.rawSessionId,
        sessionState,
        permissionState,
        safety: {
          hasStackTrace: /\n\s*at\s+\S+\s+\(|\bat\s+\S+:\d+:\d+/.test(visibleText),
          hasRawPayload: /"jsonrpc"|rawInput|rawOutput|session\/prompt|session\/new|session\/load/i.test(visibleText),
          hasTokenLikeText: /\/mcp\/[^\s"']+|token=|api[_-]?key|authorization|password|sk-[a-z0-9]/i.test(visibleText),
        },
      };
    }, FORBIDDEN_ACP_TOOLS);
    const mergedProof = { ...proof, showResult };
    const stateProof = await evidence.saveJson(
      '01-fallback-state-and-tools',
      mergedProof,
      'fallback session state, tool surface, and visible safety scan',
    );
    const screenshot = await evidence.captureScreenshot(page, '02-agentic-fallback', 'Agentic fallback chat surface');

    expect(showResult).toMatchObject({ success: true, result: { shown: true } });
    expect(proof.acpTools).toEqual([
      'acp_chat_get_permission_state',
      'acp_chat_get_session_state',
      'acp_chat_show_chat_view',
    ]);
    expect(proof.forbiddenTools).toEqual([]);
    expect(proof.inputVisible).toBe(true);
    expect(proof.loadingVisible).toBe(false);
    expect(proof.sessionState.success).toBe(true);
    expect(proof.sessionState.result.active).toBe(true);
    expect(proof.fallbackSessionId).toBeTruthy();
    expect(String(proof.fallbackSessionId)).not.toMatch(/^acp:/);
    expect(String(proof.fallbackRawSessionId)).not.toMatch(/^acp:/);
    expect(proof.sessionState.result.session.messages).toBeUndefined();
    expect(proof.sessionState.result.session.content).toBeUndefined();
    expect(proof.sessionState.result.session.toolCallResults).toBeUndefined();
    expect(proof.permissionState.success).toBe(true);
    expect(proof.permissionState.result).toEqual(
      expect.objectContaining({
        activeDialogCount: expect.any(Number),
        pendingCountExcludingActive: expect.any(Number),
      }),
    );
    expect(proof.safety).toEqual({
      hasStackTrace: false,
      hasRawPayload: false,
      hasTokenLikeText: false,
    });

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Agentic AI Chat renders a usable surface instead of staying in ACP initialization.',
      status: 'pass',
      evidence: [stateProof, screenshot].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'The fallback path creates a local non-ACP session and returns safe metadata-only state.',
      status: 'pass',
      evidence: [stateProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement:
        'Hidden mutation tools stay unavailable and visible output has no stack traces, raw payloads, or tokens.',
      status: 'pass',
      evidence: [stateProof].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: 'local-loopback query acpBddBackendReadyFailure=reject',
      },
    });
  });
});
