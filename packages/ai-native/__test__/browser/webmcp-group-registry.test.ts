import { WEBMCP_PROFILE_SETTING_ID, WebMcpGroupRegistry } from '../../src/browser/acp/webmcp-group-registry';

describe('WebMCP group registry policy', () => {
  function createRegistry(profile: string) {
    const registry = new WebMcpGroupRegistry();
    Object.defineProperty(registry, 'preferenceService', {
      value: {
        get: jest.fn((id: string, fallback: string) => (id === WEBMCP_PROFILE_SETTING_ID ? profile : fallback)),
      },
      writable: true,
    });
    registry.registerGroup({
      name: 'terminal',
      description: 'Terminal',
      defaultLoaded: true,
      tools: [
        {
          name: 'terminal_read_output',
          description: 'Read output',
          riskLevel: 'read',
          inputSchema: {},
          execute: jest.fn().mockResolvedValue({ success: true }),
        },
        {
          name: 'terminal_run_command',
          description: 'Run command',
          riskLevel: 'shell',
          profiles: ['interactive', 'full'],
          inputSchema: {},
          execute: jest.fn().mockResolvedValue({ success: true }),
        },
        {
          name: 'terminal_internal_write',
          description: 'Hidden write',
          riskLevel: 'write',
          exposedByDefault: false,
          profiles: ['full'],
          inputSchema: {},
          execute: jest.fn().mockResolvedValue({ success: true }),
        },
      ],
    });
    return registry;
  }

  it('does not expose or execute shell tools in the default profile', async () => {
    const registry = createRegistry('default');

    expect(registry.getGroupDefinitions()[0].tools.map((tool) => tool.name)).toEqual(['terminal_read_output']);
    await expect(registry.executeTool('terminal', 'terminal_run_command', {})).resolves.toMatchObject({
      success: false,
      error: 'PERMISSION_DENIED',
    });
  });

  it('executes shell tools in the interactive profile', async () => {
    const registry = createRegistry('interactive');

    expect(registry.getGroupDefinitions()[0].tools.map((tool) => tool.name)).toEqual([
      'terminal_read_output',
      'terminal_run_command',
    ]);
    await expect(registry.executeTool('terminal', 'terminal_run_command', {})).resolves.toMatchObject({
      success: true,
    });
  });

  it('does not execute tools hidden by exposedByDefault false', async () => {
    const registry = createRegistry('full');

    await expect(registry.executeTool('terminal', 'terminal_internal_write', {})).resolves.toMatchObject({
      success: false,
      error: 'PERMISSION_DENIED',
    });
  });
});
