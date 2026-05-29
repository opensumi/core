import { EnvVariable, McpServer } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

import { buildAcpAgentProcessConfig } from '../../../src/browser/acp/build-agent-process-config';

describe('buildAcpAgentProcessConfig', () => {
  const defaultRegistration = {
    command: '/usr/local/bin/agent',
    args: ['--stdio'],
    env: [{ name: 'API_KEY', value: 'default' }] as EnvVariable[],
    cwd: '/workspace',
  };

  const defaultPrefs = {
    nodePath: '',
    agents: {},
  };

  it('returns registration values when user has no overrides', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: defaultRegistration,
      userPreferences: defaultPrefs,
    });
    expect(result).toEqual({
      agentId: 'test-agent',
      command: '/usr/local/bin/agent',
      args: ['--stdio'],
      env: [{ name: 'API_KEY', value: 'default' }],
      cwd: '/workspace',
      nodePath: undefined,
    });
  });

  it('overrides command when user provides it', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: defaultRegistration,
      userPreferences: {
        ...defaultPrefs,
        agents: { 'test-agent': { command: '/custom/bin/agent' } },
      },
    });
    expect(result.command).toBe('/custom/bin/agent');
    expect(result.args).toEqual(['--stdio']);
  });

  it('REPLACES args when user provides them', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: defaultRegistration,
      userPreferences: {
        ...defaultPrefs,
        agents: { 'test-agent': { args: ['--debug', '--verbose'] } },
      },
    });
    expect(result.args).toEqual(['--debug', '--verbose']);
  });

  it('MERGE env: user keys override registration defaults', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: {
        ...defaultRegistration,
        env: [
          { name: 'API_KEY', value: 'default' },
          { name: 'KEEP', value: 'yes' },
        ],
      },
      userPreferences: {
        ...defaultPrefs,
        agents: {
          'test-agent': { env: { API_KEY: 'user-value', NEW_KEY: 'new' } },
        },
      },
    });
    const envMap = new Map(result.env!.map((v) => [v.name, v.value]));
    expect(envMap.get('API_KEY')).toBe('user-value');
    expect(envMap.get('KEEP')).toBe('yes');
    expect(envMap.get('NEW_KEY')).toBe('new');
  });

  it('uses registration defaults when agentId not in user map', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'unknown-agent',
      registration: defaultRegistration,
      userPreferences: {
        ...defaultPrefs,
        agents: { 'other-agent': { command: '/x' } },
      },
    });
    expect(result.command).toBe('/usr/local/bin/agent');
    expect(result.args).toEqual(['--stdio']);
  });

  it('sets nodePath when user provides it', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: defaultRegistration,
      userPreferences: { nodePath: '/usr/local/bin/node', agents: {} },
    });
    expect(result.nodePath).toBe('/usr/local/bin/node');
  });

  it('sets nodePath to undefined when user preference is empty string', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: defaultRegistration,
      userPreferences: { nodePath: '', agents: {} },
    });
    expect(result.nodePath).toBeUndefined();
  });

  it('includes ACP MCP servers when provided', () => {
    const mcpServers: McpServer[] = [
      {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
        env: [],
      },
    ];
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: defaultRegistration,
      userPreferences: defaultPrefs,
      mcpServers,
    });
    expect(result.mcpServers).toBe(mcpServers);
  });

  it('includes WebMCP enabled preference when provided', () => {
    const result = buildAcpAgentProcessConfig({
      agentId: 'test-agent',
      registration: defaultRegistration,
      userPreferences: {
        ...defaultPrefs,
        webMcpEnabled: false,
      },
    });
    expect(result.webMcp).toEqual({ enabled: false });
  });
});
