// Source: test/bdd/acp-chat-agentic-editor-target-reveal.scenario.md

import { expect } from '@playwright/test';

import { keypressWithCmdCtrl } from '../utils';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const AGENTIC_MAXIMIZE_BUTTON_SELECTOR =
  '#agentic-chat-panel-header-maximize [role="button"], #ai-chat-header-maximize [role="button"]';

let runtime: AcpBddFixtureRuntime;

interface EditorTargetRevealProof {
  aiChatVisible: boolean;
  workbenchVisible: boolean;
  editorVisible: boolean;
  explorerVisible: boolean;
  settingsVisible: boolean;
  maximizeWorkbenchVisibleState?: string | null;
  currentTabUris: string[];
  fatalTextVisible: boolean;
}

async function readRevealProof(): Promise<EditorTargetRevealProof> {
  return page.evaluate(() => {
    const isVisible = (element: Element | null | undefined) => {
      if (!element) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const firstVisible = (selectors: string[]) =>
      selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .find((element) => isVisible(element));
    const visibleText = document.body.innerText || '';
    const workbench = document.querySelector('#workbench-editor');

    return {
      aiChatVisible: isVisible(document.querySelector('.AI-Chat-slot')),
      workbenchVisible: isVisible(workbench),
      editorVisible: Boolean(firstVisible(['#workbench-editor .monaco-editor', '#workbench-editor [data-uri]'])),
      explorerVisible: Boolean(
        firstVisible(['[data-viewlet-id="explorer"]', '#opensumi-left-tabbar li#explorer.active']),
      ),
      settingsVisible: Boolean(firstVisible(['#workbench-editor [class*="preferences___"]'])),
      maximizeWorkbenchVisibleState: document
        .querySelector('#agentic-chat-panel-header-maximize')
        ?.getAttribute('data-workbench-visible'),
      currentTabUris: Array.from(document.querySelectorAll('#workbench-editor [data-uri]'))
        .map((element) => element.getAttribute('data-uri') || '')
        .filter(Boolean),
      fatalTextVisible: /SERVICE_UNAVAILABLE|EXECUTION_ERROR|Initializing ACP service|uncaught|stack trace/i.test(
        visibleText,
      ),
    };
  });
}

async function loadEditorTargetRevealWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'stream-rich',
    profile: 'default',
    delayMs: 10,
    showChatView: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

async function ensureHiddenAgenticWorkbench() {
  const current = await readRevealProof();
  if (!current.workbenchVisible) {
    return;
  }

  const maximizeButton = page.locator(AGENTIC_MAXIMIZE_BUTTON_SELECTOR).first();
  await expect(maximizeButton).toBeVisible({ timeout: 30_000 });
  await maximizeButton.click();
  await expect
    .poll(
      async () => {
        const proof = await readRevealProof();
        return proof.workbenchVisible;
      },
      { timeout: 30_000 },
    )
    .toBe(false);
}

async function openSettingsFromShortcut() {
  await page.keyboard.press(keypressWithCmdCtrl(','), { delay: 200 });
  await expect(page.locator('#workbench-editor [class*="preferences___"]').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('ACP Chat Agentic Editor Target Reveal', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadEditorTargetRevealWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Settings opens the hidden Agentic workbench as a foreground editor target', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-editor-target-reveal', {
      sourceScenario: 'test/bdd/acp-chat-agentic-editor-target-reveal.scenario.md',
      profile: 'default',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await ensureHiddenAgenticWorkbench();

    const collapsed = await readRevealProof();
    expect(collapsed.aiChatVisible).toBe(true);
    expect(collapsed.workbenchVisible).toBe(false);
    expect(collapsed.editorVisible).toBe(false);
    expect(collapsed.explorerVisible).toBe(false);
    expect(collapsed.maximizeWorkbenchVisibleState).toBe('false');
    const collapsedProof = await evidence.saveJson(
      '02-collapsed-before-settings',
      collapsed,
      'Agentic chat is maximized and the workbench plus Explorer are hidden before opening Settings',
    );

    await openSettingsFromShortcut();

    const afterSettings = await readRevealProof();
    expect(afterSettings.aiChatVisible).toBe(true);
    expect(afterSettings.workbenchVisible).toBe(true);
    expect(afterSettings.editorVisible).toBe(true);
    expect(afterSettings.settingsVisible).toBe(true);
    expect(afterSettings.maximizeWorkbenchVisibleState).toBe('true');
    expect(afterSettings.currentTabUris.some((uri) => uri === 'pref:/')).toBe(true);
    expect(afterSettings.fatalTextVisible).toBe(false);
    const afterSettingsProof = await evidence.saveJson(
      '03-after-settings-open',
      afterSettings,
      'Opening Settings restores the hidden Agentic workbench and renders the Settings editor',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The Agentic workbench can be hidden while AI Chat remains visible.',
      status: 'pass',
      evidence: [collapsedProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Opening a foreground editor-hosted workbench target restores the hidden Agentic workbench.',
      status: 'pass',
      evidence: [collapsedProof, afterSettingsProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'The Settings editor is visible after the workbench is restored.',
      status: 'pass',
      evidence: [afterSettingsProof].filter(Boolean) as string[],
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
