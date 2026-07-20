// Source: test/bdd/acp-chat-agentic-config-controls.scenario.md

import { type Locator, expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const CONFIG_SELECTOR = '[role="combobox"][class*="config_selector"]';

let runtime: AcpBddFixtureRuntime;

interface ConfigProof {
  configId: string;
  value: string | boolean;
  sessionId?: string;
  hasResponse: boolean;
  responseConfigOptionCount: number;
  responseCurrentValues: Array<{
    id: string;
    category?: string;
    currentValue: string | boolean;
  }>;
}

interface AcpSessionSummary {
  sessionId: string;
  rawSessionId?: string;
  requestCount: number;
}

interface PromptConfigSnapshotProof {
  hasSnapshotText: boolean;
  hasAssistantCompletion: boolean;
  snapshots: Array<{
    mode?: string;
    model?: string;
    thought?: string;
    webSearch?: boolean;
  }>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadFullProfileWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'stream-rich',
    profile: 'full',
    delayMs: 5,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1800, height: 1000 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

function configSelectors(): Locator {
  return page.locator(CONFIG_SELECTOR);
}

async function readFooterConfigValues(): Promise<string[]> {
  return (await configSelectors().allTextContents()).map((value) => value.replace(/\s+/g, ' ').trim());
}

async function executeAcpTool<T>(name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  ) as Promise<{ success: boolean; result: T }>;
}

async function getSessionState() {
  const result = await executeAcpTool<{ active: boolean; session: AcpSessionSummary | null }>(
    'acp_chat_get_session_state',
  );
  expect(result.success).toBe(true);
  return result.result;
}

async function waitForActiveConfigSession() {
  await expect
    .poll(
      async () => {
        const state = await getSessionState();
        return {
          active: state.active,
          rawSessionId: state.session?.rawSessionId || state.session?.sessionId?.replace(/^acp:/, '') || '',
          requestReady: (state.session?.requestCount ?? 0) > 0,
          configCount: await configSelectors().count(),
        };
      },
      { message: 'ACP config session did not become active after bootstrap prompt', timeout: 30_000 },
    )
    .toMatchObject({
      active: true,
      rawSessionId: expect.stringMatching(/^bdd-session-/),
      requestReady: true,
      configCount: 4,
    });

  return getSessionState();
}

async function selectFooterConfig(comboIndex: number, label: string) {
  const combo = configSelectors().nth(comboIndex);
  await expect(combo).toBeVisible();
  await combo.click();

  const option = page
    .locator('[role="option"]')
    .filter({
      has: page.locator('[class*="option_label"]', {
        hasText: new RegExp(`^${escapeRegExp(label)}$`),
      }),
    })
    .first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(combo).toContainText(label);
}

async function openAndClearAcpDebugLog() {
  await runtime.app.quickCommandPalette.type('Open ACP Debug Log');
  await expect(page.getByText('Open ACP Debug Log', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'ACP Debug Log' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('No ACP debug log entries yet.')).toBeVisible();
}

async function readSetConfigProof(): Promise<ConfigProof[]> {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const jsonLines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{"jsonrpc"'));
    const messages: any[] = [];
    for (const line of jsonLines) {
      try {
        messages.push(JSON.parse(line));
      } catch (_error) {
        // Ignore pretty-printed or partial log lines.
      }
    }

    const requests = messages.filter((message) => message.method === 'session/set_config_option');
    const responsesById = new Map(
      messages
        .filter((message) => message.id !== undefined && message.result && Array.isArray(message.result.configOptions))
        .map((message) => [String(message.id), message]),
    );

    return requests.map((request) => {
      const response = responsesById.get(String(request.id));
      const options = response?.result?.configOptions || [];
      return {
        configId: request.params?.configId,
        value: request.params?.value,
        sessionId: request.params?.sessionId,
        hasResponse: !!response,
        responseConfigOptionCount: options.length,
        responseCurrentValues: options.map((option: any) => ({
          id: option.id,
          category: option.category,
          currentValue: option.currentValue,
        })),
      };
    });
  });
}

async function waitForSetConfigProofValues() {
  await page.waitForFunction(() => {
    const compactLog = (document.body.innerText || '').replace(/\s+/g, '');
    return (
      compactLog.includes('"method":"session/set_config_option"') &&
      compactLog.includes('"configId":"bdd-mode","value":"chat"') &&
      compactLog.includes('"configId":"bdd-model","value":"bdd-large"') &&
      compactLog.includes('"configId":"bdd-thought-level","value":"high"') &&
      compactLog.includes('"configId":"bdd-web-search","value":true') &&
      compactLog.includes('"id":"bdd-mode"') &&
      compactLog.includes('"category":"mode"') &&
      compactLog.includes('"currentValue":"chat"') &&
      compactLog.includes('"id":"bdd-model"') &&
      compactLog.includes('"category":"model"') &&
      compactLog.includes('"currentValue":"bdd-large"') &&
      compactLog.includes('"id":"bdd-thought-level"') &&
      compactLog.includes('"category":"thought_level"') &&
      compactLog.includes('"currentValue":"high"') &&
      compactLog.includes('"id":"bdd-web-search"') &&
      compactLog.includes('"category":"_bdd_feature"') &&
      compactLog.includes('"currentValue":true')
    );
  });
}

function expectProofValue(proof: ConfigProof[], configId: string, value: string | boolean, category?: string) {
  const item = proof.find((entry) => entry.configId === configId && entry.value === value);
  expect(item, `missing set_config_option proof for ${configId}=${value}`).toBeDefined();
  expect(item?.sessionId).toMatch(/^bdd-session-/);
  expect(item?.hasResponse).toBe(true);
  expect(item?.responseConfigOptionCount).toBeGreaterThanOrEqual(4);

  const returnedOption = item?.responseCurrentValues.find((option) => option.id === configId);
  expect(returnedOption).toMatchObject({
    id: configId,
    currentValue: value,
    ...(category ? { category } : {}),
  });
}

async function sendDeterministicPrompt() {
  const completion = page.locator('.AI-Chat-slot').getByText('BDD_ASSISTANT_PART_2 completed.');
  const completionCount = await completion.count();
  const input = page.locator('.AI-Chat-slot [contenteditable="true"]').last();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type('BDD config controls snapshot');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(completion).toHaveCount(completionCount + 1, {
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
}

async function createConfigSession() {
  const completion = page.locator('.AI-Chat-slot').getByText('BDD_ASSISTANT_PART_2 completed.');
  const completionCount = await completion.count();
  const input = page.locator('.AI-Chat-slot [contenteditable="true"]').last();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type('BDD config controls bootstrap');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(completion).toHaveCount(completionCount + 1, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
  await expect(configSelectors()).toHaveCount(4, { timeout: 30_000 });
  return waitForActiveConfigSession();
}

async function waitForPromptConfigSnapshot() {
  const snapshotText = 'BDD_CONFIG_SNAPSHOT mode=chat model=bdd-large thought=high webSearch=true';
  const chatSlot = page.locator('.AI-Chat-slot');
  if (!((await chatSlot.textContent()) || '').includes(snapshotText)) {
    const thinking = page.getByRole('button', { name: /Deep Thinking/ }).last();
    await expect(thinking).toBeVisible({ timeout: 30_000 });
    await thinking.click();
  }
  await expect.poll(async () => (await chatSlot.textContent()) || '', { timeout: 10_000 }).toContain(snapshotText);
  await expect(page.locator('.AI-Chat-slot').getByText('BDD_ASSISTANT_PART_2 completed.').last()).toBeVisible();
}

async function readPromptConfigSnapshotProof(): Promise<PromptConfigSnapshotProof> {
  const hasSnapshotText = ((await page.locator('.AI-Chat-slot').textContent()) || '').includes(
    'BDD_CONFIG_SNAPSHOT mode=chat model=bdd-large thought=high webSearch=true',
  );
  return {
    hasSnapshotText,
    hasAssistantCompletion: await page
      .locator('.AI-Chat-slot')
      .getByText('BDD_ASSISTANT_PART_2 completed.')
      .last()
      .isVisible(),
    snapshots: hasSnapshotText ? [{ mode: 'chat', model: 'bdd-large', thought: 'high', webSearch: true }] : [],
  };
}

async function restoreDefaultConfigValues() {
  if ((await configSelectors().count()) < 4) {
    return;
  }
  if (
    await page
      .getByRole('button', { name: 'Stop' })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
  }
  await selectFooterConfig(0, 'Agent');
  await selectFooterConfig(1, 'BDD Small');
  await selectFooterConfig(2, 'Medium');
  await selectFooterConfig(3, 'Off');
}

test.describe('ACP Chat Agentic footer config controls', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadFullProfileWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('applies footer config options through ACP session config protocol', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-config-controls', {
      sourceScenario: 'test/bdd/acp-chat-agentic-config-controls.scenario.md',
      profile: 'full',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await openAndClearAcpDebugLog();
    const activeConfigSession = await createConfigSession();

    await expect(configSelectors()).toHaveCount(4);
    const initialFooterValues = await readFooterConfigValues();
    expect(initialFooterValues).toEqual(['Agent', 'BDD Small', 'Medium', 'Off']);
    const initialFooterProof = await evidence.saveJson(
      '01-initial-footer-config',
      { values: initialFooterValues, activeSession: activeConfigSession.session },
      'initial ACP footer config values',
    );

    try {
      await selectFooterConfig(0, 'Chat');
      await selectFooterConfig(1, 'BDD Large');
      await selectFooterConfig(2, 'High');
      await selectFooterConfig(3, 'On');
      const changedFooterValues = await readFooterConfigValues();
      expect(changedFooterValues).toEqual(['Chat', 'BDD Large', 'High', 'On']);
      const changedFooterProof = await evidence.saveJson(
        '02-changed-footer-config',
        { values: changedFooterValues },
        'changed ACP footer config values after UI selection',
      );
      const changedFooterScreenshot = await evidence.captureScreenshot(
        page,
        '03-changed-footer-config',
        'footer config selectors after selection',
      );

      await waitForSetConfigProofValues();
      const proof = await readSetConfigProof();
      expectProofValue(proof, 'bdd-mode', 'chat', 'mode');
      expectProofValue(proof, 'bdd-model', 'bdd-large', 'model');
      expectProofValue(proof, 'bdd-thought-level', 'high', 'thought_level');
      expectProofValue(proof, 'bdd-web-search', true, '_bdd_feature');
      const setConfigProof = await evidence.saveJson(
        '04-set-config-protocol-proof',
        proof,
        'ACP session/set_config_option protocol proof',
      );

      await sendDeterministicPrompt();
      await waitForPromptConfigSnapshot();
      const promptProof = await readPromptConfigSnapshotProof();
      expect(promptProof).toMatchObject({
        hasSnapshotText: true,
        hasAssistantCompletion: true,
      });
      expect(promptProof.snapshots).toContainEqual({
        mode: 'chat',
        model: 'bdd-large',
        thought: 'high',
        webSearch: true,
      });
      const promptConfigProof = await evidence.saveJson(
        '05-prompt-config-snapshot-proof',
        promptProof,
        'prompt turn used the selected config option values',
      );

      expect(await readFooterConfigValues()).toEqual(['Chat', 'BDD Large', 'High', 'On']);

      evidence.recordCriticalPoint({
        id: 'CP1',
        requirement: 'Footer renders exactly the deterministic ACP config option values in order.',
        status: 'pass',
        evidence: [initialFooterProof].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP2',
        requirement: 'Changing mode/model/thought/web-search visibly updates footer controls.',
        status: 'pass',
        evidence: [changedFooterProof, changedFooterScreenshot].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP3',
        requirement: 'Each visible config change sends session/set_config_option with exact configId and value.',
        status: 'pass',
        evidence: [setConfigProof].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP4',
        requirement: 'The deterministic prompt turn receives the selected config snapshot.',
        status: 'pass',
        evidence: [promptConfigProof].filter(Boolean) as string[],
      });
    } finally {
      await restoreDefaultConfigValues();
    }

    const restoredFooterValues = await readFooterConfigValues();
    expect(restoredFooterValues).toEqual(['Agent', 'BDD Small', 'Medium', 'Off']);
    const restoredFooterProof = await evidence.saveJson(
      '06-restored-footer-config',
      { values: restoredFooterValues },
      'restored ACP footer config values',
    );
    evidence.recordCriticalPoint({
      id: 'CP5',
      requirement: 'Footer config values are restored after the deterministic fixture run.',
      status: 'pass',
      evidence: [restoredFooterProof].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: 'stream-rich',
        profile: 'full',
      },
    });
  });
});
