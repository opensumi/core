// Source: test/bdd/session-mode.scenario.md

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const PROMPT = 'BDD session mode bootstrap';
const COMPLETION = 'BDD_ASSISTANT_PART_2 completed.';

let runtime: AcpBddFixtureRuntime;

function parseToolResult(result: any) {
  const text = result.content?.find((item: any) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : undefined;
}

async function createFreshMcpClient() {
  const connection = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('opensumi_get_mcp_server_connection', {}),
  );
  expect(connection.success).toBe(true);
  const client = new Client({ name: 'opensumi-bdd-session-mode', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(connection.result.url));
  await client.connect(transport);
  return client;
}

test.describe('ACP Chat Session Mode', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'full',
      delayMs: 20,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
    const input = page.getByRole('textbox', { name: 'Agentic chat input' });
    await input.click();
    await page.keyboard.insertText(PROMPT);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.AI-Chat-slot').getByText(COMPLETION)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('full profile 通过 fresh MCP transport 返回请求的 agent/chat mode', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'session-mode', {
      sourceScenario: 'test/bdd/session-mode.scenario.md',
      profile: 'full',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });
    const client = await createFreshMcpClient();
    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).toEqual(expect.arrayContaining(['acp_chat_set_session_mode', 'acp_chat_get_session_state']));

      const initial = parseToolResult(await client.callTool({ name: 'acp_chat_get_session_state', arguments: {} }));
      expect(initial).toMatchObject({ success: true, result: { active: true } });

      const setAgent = parseToolResult(
        await client.callTool({ name: 'acp_chat_set_session_mode', arguments: { modeId: 'agent' } }),
      );
      expect(setAgent).toMatchObject({ success: true, result: { modeId: 'agent' } });
      const stateAgent = parseToolResult(await client.callTool({ name: 'acp_chat_get_session_state', arguments: {} }));
      expect(stateAgent).toMatchObject({ success: true, result: { active: true } });

      const setChat = parseToolResult(
        await client.callTool({ name: 'acp_chat_set_session_mode', arguments: { modeId: 'chat' } }),
      );
      expect(setChat).toMatchObject({ success: true, result: { modeId: 'chat' } });
      const stateChat = parseToolResult(await client.callTool({ name: 'acp_chat_get_session_state', arguments: {} }));
      expect(stateChat).toMatchObject({ success: true, result: { active: true } });

      const agentSession = stateAgent.result.session || {};
      const chatSession = stateChat.result.session || {};
      const serializedStates = JSON.stringify({ stateAgent, stateChat });
      for (const forbidden of [COMPLETION, 'BDD_TOOL_RESULT', 'BDD_THOUGHT_STEP_1']) {
        expect(serializedStates).not.toContain(forbidden);
      }
      expect(Object.keys(agentSession)).toEqual(
        expect.not.arrayContaining(['messages', 'history', 'content', 'toolCalls', 'configOptions']),
      );

      const proof = await evidence.saveJson(
        '01-session-mode-return-contract',
        {
          setAgent,
          setChat,
          agentKeys: Object.keys(agentSession),
          chatKeys: Object.keys(chatSession),
          hasModeField: 'currentModeId' in agentSession || 'modeId' in agentSession || 'sessionMode' in agentSession,
          boundedTitle: agentSession.title,
          metadataOnly: ![COMPLETION, 'BDD_TOOL_RESULT'].some((value) => serializedStates.includes(value)),
        },
        'full-profile fresh MCP transport 的 mode 切换返回值与安全 session state',
      );
      evidence.recordCriticalPoint({
        id: 'CP1',
        requirement: 'full profile 无需 enable helper 即可调用 set_session_mode，并返回 agent/chat modeId。',
        status: 'pass',
        evidence: [proof].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP2',
        requirement: '切换前后 Session 保持 active，state 只返回安全 metadata。',
        status: 'pass',
        evidence: [proof].filter(Boolean) as string[],
      });
      await evidence.finalize({
        scenarioVerdict: 'PASS',
        hardeningVerdict: 'CONVERT',
        runtime: {
          url: page.url(),
          viewport: page.viewportSize(),
          browserSurface: 'Playwright Chromium + fresh Streamable HTTP MCP client',
          fixture: runtime.fixture,
          profile: runtime.profile,
        },
      });
    } finally {
      await client.close();
    }
  });
});
