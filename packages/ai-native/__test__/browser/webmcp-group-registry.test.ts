import {
  WEBMCP_PROFILE_QUERY_PARAM,
  WEBMCP_PROFILE_SETTING_ID,
  WebMcpGroupRegistry,
  canUseWebMcpProfileQueryOverride,
  getWebMcpProfileFromSearch,
} from '../../src/browser/acp/webmcp-group-registry';
import { createEditorGroup } from '../../src/browser/acp/webmcp-groups/editor.webmcp-group';
import { createTerminalGroup } from '../../src/browser/acp/webmcp-groups/terminal.webmcp-group';

describe('WebMCP group registry policy', () => {
  function createRegistryWithProfile(profile: string) {
    const registry = new WebMcpGroupRegistry();
    Object.defineProperty(registry, 'preferenceService', {
      value: {
        get: jest.fn((id: string, fallback: string) => (id === WEBMCP_PROFILE_SETTING_ID ? profile : fallback)),
      },
      writable: true,
    });
    return registry;
  }

  function createRegistry(profile: string) {
    const registry = createRegistryWithProfile(profile);
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

  it('parses runtime profile overrides from URL search params', () => {
    expect(getWebMcpProfileFromSearch(`?${WEBMCP_PROFILE_QUERY_PARAM}=interactive`)).toBe('interactive');
    expect(getWebMcpProfileFromSearch(`?${WEBMCP_PROFILE_SETTING_ID}=full`)).toBe('full');
    expect(getWebMcpProfileFromSearch(`?${WEBMCP_PROFILE_QUERY_PARAM}=invalid&${WEBMCP_PROFILE_SETTING_ID}=full`)).toBe(
      'full',
    );
    expect(getWebMcpProfileFromSearch(`?${WEBMCP_PROFILE_QUERY_PARAM}=invalid`)).toBeUndefined();
    expect(getWebMcpProfileFromSearch('')).toBeUndefined();
  });

  it('only allows URL profile overrides on loopback hosts', () => {
    expect(canUseWebMcpProfileQueryOverride('localhost')).toBe(true);
    expect(canUseWebMcpProfileQueryOverride('127.0.0.1')).toBe(true);
    expect(canUseWebMcpProfileQueryOverride('::1')).toBe(true);
    expect(canUseWebMcpProfileQueryOverride('example.com')).toBe(false);
  });

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

  it('prefers the URL profile override over the persisted preference', async () => {
    const previousUrl = window.location.href;
    window.history.pushState({}, '', `/?${WEBMCP_PROFILE_QUERY_PARAM}=interactive`);
    try {
      const registry = createRegistry('default');

      expect(registry.getGroupDefinitions()[0].tools.map((tool) => tool.name)).toEqual([
        'terminal_read_output',
        'terminal_run_command',
      ]);
      await expect(registry.executeTool('terminal', 'terminal_run_command', {})).resolves.toMatchObject({
        success: true,
      });
    } finally {
      window.history.pushState({}, '', previousUrl);
    }
  });

  it('exposes editor save/format and terminal disposal only in the full profile', () => {
    const defaultRegistry = createRegistryWithProfile('default');
    const fullRegistry = createRegistryWithProfile('full');
    const container = {} as any;
    for (const registry of [defaultRegistry, fullRegistry]) {
      registry.registerGroup(createEditorGroup(container));
      registry.registerGroup(createTerminalGroup(container));
    }

    const defaultTools = defaultRegistry.getGroupDefinitions().flatMap((group) => group.tools.map((tool) => tool.name));
    expect(defaultTools).not.toEqual(expect.arrayContaining(['editor_format', 'editor_save', 'terminal_dispose']));

    const fullTools = fullRegistry.getGroupDefinitions().flatMap((group) => group.tools.map((tool) => tool.name));
    expect(fullTools).toEqual(expect.arrayContaining(['editor_format', 'editor_save', 'terminal_dispose']));
  });
});
