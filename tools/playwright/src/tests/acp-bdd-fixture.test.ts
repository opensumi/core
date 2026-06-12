import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '@playwright/test';

import {
  ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM,
  ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE,
  aiNativeWorkbenchUrl,
  writeMockAcpAgentSettings,
} from './utils/acp-bdd-fixture';

async function readSettings(workspaceDir: string) {
  return JSON.parse(await fs.readFile(path.join(workspaceDir, '.sumi/settings.json'), 'utf8'));
}

function readDefaultAgent(settings: any) {
  const agentType = settings['ai.native.agent.defaultType'];
  return settings['ai-native.acp.agents'][agentType];
}

test.describe('ACP BDD fixture scheduling', () => {
  test('writes fixture-specific mock ACP agent commands into workspace settings', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opensumi-acp-bdd-fixture-'));

    try {
      await writeMockAcpAgentSettings(workspaceDir, {
        fixture: 'stream-rich',
        delayMs: 5,
        sessionPrefix: 'bdd-rich',
      });

      let settings = await readSettings(workspaceDir);
      let agent = readDefaultAgent(settings);
      expect(settings['ai.native.agent.defaultType']).toBe('claude-agent-acp');
      expect(agent.args).toEqual(expect.arrayContaining(['--fixture=stream-rich', '--delay-ms=5']));
      expect(agent.env).toMatchObject({
        OPENSUMI_ACP_BDD_FIXTURE: 'stream-rich',
        OPENSUMI_ACP_BDD_DELAY_MS: '5',
        OPENSUMI_ACP_BDD_SESSION_PREFIX: 'bdd-rich',
      });

      await writeMockAcpAgentSettings(workspaceDir, {
        fixture: 'long-stream',
        delayMs: 1,
        longStreamTicks: 3,
        sessionPrefix: 'bdd-long',
      });

      settings = await readSettings(workspaceDir);
      agent = readDefaultAgent(settings);
      expect(agent.args).toEqual(
        expect.arrayContaining(['--fixture=long-stream', '--delay-ms=1', '--long-stream-ticks=3']),
      );
      expect(agent.args).not.toContain('--fixture=stream-rich');
      expect(agent.env).toMatchObject({
        OPENSUMI_ACP_BDD_FIXTURE: 'long-stream',
        OPENSUMI_ACP_BDD_DELAY_MS: '1',
        OPENSUMI_ACP_BDD_LONG_STREAM_TICKS: '3',
        OPENSUMI_ACP_BDD_SESSION_PREFIX: 'bdd-long',
      });
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  test('adds the backend readiness failure query only when requested', async () => {
    const defaultUrl = aiNativeWorkbenchUrl('/tmp/workspace');
    const fallbackUrl = aiNativeWorkbenchUrl('/tmp/workspace', 'default', 'agentic', {
      forceAcpBackendReadyFailure: true,
    });

    expect(defaultUrl).not.toContain(ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM);
    expect(fallbackUrl).toContain(
      `${ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM}=${ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE}`,
    );
  });
});
