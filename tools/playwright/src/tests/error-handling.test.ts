// Source: test/bdd/error-handling.scenario.md

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

const LEGACY_TOOLS = [
  'acp_sendMessage',
  'acp_createSession',
  'acp_switchSession',
  'acp_clearSession',
  'acp_cancelRequest',
  'acp_handlePermissionDialog',
];
const FULL_TOOLS = ['acp_chat_set_session_mode', 'acp_chat_post_prepared_relay', 'acp_chat_read_session_messages'];

function parseToolResult(result: any) {
  const text = result.content?.find((item: any) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : undefined;
}

async function createFreshMcpClient() {
  const connection = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('opensumi_get_mcp_server_connection', {}),
  );
  expect(connection.success).toBe(true);
  const client = new Client({ name: 'opensumi-bdd-error-handling', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(connection.result.url));
  await client.connect(transport);
  return { client, redactedUrl: connection.result.redactedUrl as string };
}

test.describe('ACP Chat MCP 错误边界', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 2);

  test('profile gating、旧工具和非法输入返回稳定且不泄漏的错误', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'error-handling', {
      sourceScenario: 'test/bdd/error-handling.scenario.md',
      profile: 'full',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });
    let interactiveRuntime: AcpBddFixtureRuntime | undefined;
    let fullRuntime: AcpBddFixtureRuntime | undefined;

    try {
      interactiveRuntime = await loadAcpBddFixtureWorkbench(page, {
        fixture: 'stream-rich',
        profile: 'interactive',
        showChatView: true,
        ensureAgenticLayout: true,
        viewport: { width: 1600, height: 900 },
      });
      const interactiveConnection = await createFreshMcpClient();
      let interactiveNames: string[] = [];
      try {
        interactiveNames = (await interactiveConnection.client.listTools()).tools.map((tool) => tool.name);
        expect(interactiveNames).toEqual(expect.not.arrayContaining(FULL_TOOLS));
        await interactiveConnection.client.callTool({
          name: 'opensumi_enable_capability_group',
          arguments: { group: 'acp_chat' },
        });
        const afterEnable = (await interactiveConnection.client.listTools()).tools.map((tool) => tool.name);
        expect(afterEnable).toEqual(expect.not.arrayContaining(FULL_TOOLS));
        const denied = await interactiveConnection.client.callTool({
          name: 'opensumi_invoke_capability_tool',
          arguments: { tool: 'acp_chat_set_session_mode', arguments: { modeId: 'agent' } },
        });
        expect(denied.isError).toBe(true);
      } finally {
        await interactiveConnection.client.close();
      }
      await interactiveRuntime.dispose();
      interactiveRuntime = undefined;

      fullRuntime = await loadAcpBddFixtureWorkbench(page, {
        fixture: 'stream-rich',
        profile: 'full',
        showChatView: true,
        ensureAgenticLayout: true,
        viewport: { width: 1600, height: 900 },
      });
      const fullConnection = await createFreshMcpClient();
      let fullNames: string[] = [];
      const invalidResults: Record<string, unknown> = {};
      try {
        fullNames = (await fullConnection.client.listTools()).tools.map((tool) => tool.name);
        expect(fullNames).toEqual(expect.arrayContaining(FULL_TOOLS));
        expect(fullNames).toEqual(expect.not.arrayContaining(LEGACY_TOOLS));

        const legacy = await fullConnection.client.callTool({
          name: 'acp_sendMessage',
          arguments: { message: 'hello' },
        });
        expect(legacy.isError).toBe(true);

        const described = parseToolResult(
          await fullConnection.client.callTool({
            name: 'opensumi_describe_capability_group',
            arguments: { group: 'acp_chat', includeSchemas: true },
          }),
        );
        expect(described).toMatchObject({ success: true, result: { group: 'acp_chat' } });

        for (const [name, args] of [
          ['acp_chat_set_session_mode', { modeId: '' }],
          ['acp_chat_prepare_session_digest', { sourceSessionId: '' }],
          ['acp_chat_post_prepared_relay', { digestId: '', targetSessionId: '' }],
          ['acp_chat_read_session_messages', { sessionId: '' }],
        ] as const) {
          const response = await fullConnection.client.callTool({ name, arguments: args });
          const parsed = parseToolResult(response);
          expect(parsed).toMatchObject({ success: false, error: 'INVALID_INPUT' });
          const serialized = JSON.stringify(parsed);
          expect(serialized).not.toContain('BDD_ASSISTANT');
          expect(serialized).not.toContain('permission');
          expect(serialized).not.toContain('relay digest body');
          invalidResults[name] = parsed;
        }
      } finally {
        await fullConnection.client.close();
      }

      const proof = await evidence.saveJson(
        '01-mcp-error-boundaries',
        {
          interactiveToolCount: interactiveNames.length,
          interactiveFullTools: interactiveNames.filter((name) => FULL_TOOLS.includes(name)),
          fullToolCount: fullNames.length,
          fullTools: FULL_TOOLS.filter((name) => fullNames.includes(name)),
          legacyTools: LEGACY_TOOLS.filter((name) => fullNames.includes(name)),
          invalidResults,
        },
        'fresh MCP transport 下的 profile gating、legacy 边界和非法输入错误',
      );
      evidence.recordCriticalPoint({
        id: 'CP1',
        requirement: 'interactive 不暴露 full 工具，enable helper 不能绕过 profile；full 直接暴露工具。',
        status: 'pass',
        evidence: [proof].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP2',
        requirement: 'legacy 工具缺失，四类空参数返回 INVALID_INPUT 且不泄漏内容。',
        status: 'pass',
        evidence: [proof].filter(Boolean) as string[],
      });
      await evidence.finalize({
        scenarioVerdict: 'PASS',
        hardeningVerdict: 'CONVERT',
        runtime: {
          url: page.url(),
          viewport: page.viewportSize(),
          browserSurface: 'Playwright Chromium + fresh Streamable HTTP MCP clients',
          fixture: fullRuntime.fixture,
          profile: fullRuntime.profile,
        },
      });
    } finally {
      await interactiveRuntime?.dispose();
      await fullRuntime?.dispose();
    }
  });
});
