import { resolveAgentSpawnConfig } from '../../../src/node/acp/acp-spawn-config';

describe('resolveAgentSpawnConfig', () => {
  const baseConfig = {
    agentId: 'test-agent',
    command: '/usr/local/bin/agent',
    args: ['--stdio'],
    cwd: '/workspace',
  };

  const defaultProcessEnv = { PATH: '/usr/bin:/bin' };
  const defaultExecPath = '/usr/bin/node';

  it('uses processExecPath as nodePath fallback when nothing else is set', () => {
    const result = resolveAgentSpawnConfig({
      config: { ...baseConfig },
      processEnv: { ...defaultProcessEnv },
      processExecPath: defaultExecPath,
    });
    expect(result.env.NODE).toBe('/usr/bin/node');
    expect(result.env.PATH).toMatch(/^\/usr\b/);
  });

  it('uses config.nodePath when set', () => {
    const result = resolveAgentSpawnConfig({
      config: { ...baseConfig, nodePath: '/custom/node' },
      processEnv: { ...defaultProcessEnv },
      processExecPath: defaultExecPath,
    });
    expect(result.env.NODE).toBe('/custom/node');
    expect(result.env.PATH).toMatch(/^\/custom\b/);
  });

  it('env var SUMI_ACP_NODE_PATH wins over preference', () => {
    const result = resolveAgentSpawnConfig({
      config: { ...baseConfig, nodePath: '/pref/node' },
      processEnv: { ...defaultProcessEnv, SUMI_ACP_NODE_PATH: '/env/node' },
      processExecPath: defaultExecPath,
    });
    expect(result.env.NODE).toBe('/env/node');
  });

  it('env var SUMI_ACP_AGENT_PATH wins over config.command', () => {
    const result = resolveAgentSpawnConfig({
      config: { ...baseConfig, command: '/reg/agent' },
      processEnv: { ...defaultProcessEnv, SUMI_ACP_AGENT_PATH: '/env/agent' },
      processExecPath: defaultExecPath,
    });
    expect(result.command).toBe('/env/agent');
  });

  it('handles Windows path correctly', () => {
    // This test only makes sense on Windows where path.isAbsolute and
    // path.dirname understand backslash paths
    if (process.platform !== 'win32') {
      return;
    }
    const result = resolveAgentSpawnConfig({
      config: { ...baseConfig },
      processEnv: { PATH: 'C:\\Windows\\system32' },
      processExecPath: 'C:\\Program Files\\nodejs\\node.exe',
    });
    expect(result.env.NODE).toBe('C:\\Program Files\\nodejs\\node');
    expect(result.env.PATH).toContain('C:\\Program Files\\nodejs');
    expect(result.env.PATH).toContain(';');
  });

  it('handles undefined PATH gracefully (no leading delimiter)', () => {
    const result = resolveAgentSpawnConfig({
      config: { ...baseConfig },
      processEnv: {},
      processExecPath: '/usr/bin/node',
    });
    expect(result.env.PATH).not.toMatch(/^[;:]/);
  });

  it('forces NODE/PATH even when config.env contains them', () => {
    const result = resolveAgentSpawnConfig({
      config: {
        ...baseConfig,
        env: [
          { name: 'NODE', value: '/hacked/node' },
          { name: 'PATH', value: '/hacked' },
          { name: 'OTHER', value: 'keep' },
        ],
      },
      processEnv: { ...defaultProcessEnv },
      processExecPath: defaultExecPath,
    });
    expect(result.env.NODE).toBe('/usr/bin/node');
    expect(result.env.OTHER).toBe('keep');
  });

  it('throws when nodePath resolves to relative path', () => {
    expect(() =>
      resolveAgentSpawnConfig({
        config: { ...baseConfig, nodePath: 'node' },
        processEnv: { ...defaultProcessEnv },
        processExecPath: defaultExecPath,
      }),
    ).toThrow(/nodePath must be an absolute path/);
  });

  it('throws when processExecPath is relative and nothing else set', () => {
    expect(() =>
      resolveAgentSpawnConfig({
        config: { ...baseConfig },
        processEnv: { ...defaultProcessEnv },
        processExecPath: 'node',
      }),
    ).toThrow(/nodePath must be an absolute path/);
  });

  it('converts env array to Record correctly', () => {
    const result = resolveAgentSpawnConfig({
      config: {
        ...baseConfig,
        env: [{ name: 'FOO', value: 'bar' }],
      },
      processEnv: {},
      processExecPath: '/usr/bin/node',
    });
    expect(result.env.FOO).toBe('bar');
  });
});
