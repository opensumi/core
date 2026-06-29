// Source: test/bdd/available-commands.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

let runtime: AcpBddFixtureRuntime;

test.describe('Available commands deterministic fixture surface', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'interactive',
      delayMs: 5,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('exposes stable mock ACP command metadata through WebMCP', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'available-commands', {
      sourceScenario: 'test/bdd/available-commands.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const modelContext = (navigator as any).modelContext;
            if (!modelContext?.executeTool) {
              return 0;
            }
            const result = await modelContext.executeTool('acp_chat_get_available_commands', {});
            return result?.success === true ? result.result?.commands?.length || 0 : 0;
          }),
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(3);

    const proof = await page.evaluate(async () => {
      const modelContext = (navigator as any).modelContext;
      const tools = await modelContext.getTools();
      const commandResult = await modelContext.executeTool('acp_chat_get_available_commands', {});
      return {
        acpTools: tools
          .map((tool: { name: string }) => tool.name)
          .filter((name: string) => name.startsWith('acp_chat')),
        commandResult,
      };
    });

    const commandProof = await evidence.saveJson(
      '01-available-commands',
      proof,
      'deterministic ACP command metadata returned through WebMCP',
    );

    expect(proof.acpTools).toContain('acp_chat_get_available_commands');
    expect(proof.commandResult).toMatchObject({
      success: true,
      result: {
        total: 3,
      },
    });
    expect(proof.commandResult.result.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'bdd_echo', description: expect.any(String) }),
        expect.objectContaining({ name: 'bdd_plan', description: expect.any(String) }),
        expect.objectContaining({ name: 'bdd_permission', description: expect.any(String) }),
      ]),
    );
    expect(JSON.stringify(proof.commandResult)).not.toContain('BDD_ASSISTANT');
    expect(JSON.stringify(proof.commandResult)).not.toContain('toolCall');

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Interactive profile exposes acp_chat_get_available_commands.',
      status: 'pass',
      evidence: [commandProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'The stream-rich fixture provides stable command metadata without chat content leakage.',
      status: 'pass',
      evidence: [commandProof].filter(Boolean) as string[],
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
