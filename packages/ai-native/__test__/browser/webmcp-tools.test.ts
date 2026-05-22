import { ensureModelContext } from '@opensumi/ide-core-browser/lib/webmcp-polyfill';
import { registerAcpWebMCPTools } from '../../src/browser/acp/webmcp-tools.registry';

describe('WebMCP Tools - ACP', () => {
  let disposable: { dispose: () => void };

  beforeAll(() => {
    ensureModelContext();
    const mockContainer = {
      get: jest.fn().mockImplementation(() => {
        throw new Error('DI token not mocked');
      }),
    } as any;
    disposable = registerAcpWebMCPTools(mockContainer);
  });

  afterAll(() => disposable.dispose());

  describe('acp_listSessions', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_listSessions', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_createSession', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_createSession', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_switchSession', () => {
    it('returns error when sessionId is missing', async () => {
      const result = await navigator.modelContext!.executeTool('acp_switchSession', {});
      expect(result).toMatchObject({ success: false, error: 'INVALID_INPUT' });
    });

    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_switchSession', { sessionId: 'test-id' });
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_getSessionState', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_getSessionState', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_sendMessage', () => {
    it('returns error when message is empty', async () => {
      const result = await navigator.modelContext!.executeTool('acp_sendMessage', { message: '' });
      expect(result).toMatchObject({ success: false, error: 'INVALID_INPUT' });
    });

    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_sendMessage', { message: 'hello' });
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_clearSession', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_clearSession', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_cancelRequest', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_cancelRequest', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_getAvailableCommands', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_getAvailableCommands', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_setSessionMode', () => {
    it('returns error when modeId is missing', async () => {
      const result = await navigator.modelContext!.executeTool('acp_setSessionMode', {});
      expect(result).toMatchObject({ success: false, error: 'INVALID_INPUT' });
    });

    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_setSessionMode', { modeId: 'agent' });
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_showChatView', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_showChatView', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('acp_getPermissionDialogState', () => {
    it('returns error when service unavailable', async () => {
      const result = await navigator.modelContext!.executeTool('acp_getPermissionDialogState', {});
      expect(result).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('getTools', () => {
    it('returns all registered tools without execute functions', () => {
      const tools = navigator.modelContext!.getTools();
      expect(tools.length).toBe(11);
      for (const tool of tools) {
        expect(tool).not.toHaveProperty('execute');
        expect(tool.name).toMatch(/^acp_\w+$/);
      }
    });

    it('contains expected tool names', () => {
      const toolNames = navigator.modelContext!.getTools().map((t) => t.name);
      expect(toolNames).toContain('acp_listSessions');
      expect(toolNames).toContain('acp_createSession');
      expect(toolNames).toContain('acp_switchSession');
      expect(toolNames).toContain('acp_getSessionState');
      expect(toolNames).toContain('acp_sendMessage');
      expect(toolNames).toContain('acp_clearSession');
      expect(toolNames).toContain('acp_cancelRequest');
      expect(toolNames).toContain('acp_getAvailableCommands');
      expect(toolNames).toContain('acp_setSessionMode');
      expect(toolNames).toContain('acp_showChatView');
      expect(toolNames).toContain('acp_getPermissionDialogState');
    });
  });
});

describe('WebMCP Tools - ACP (happy path)', () => {
  let disposable: { dispose: () => void };

  const mockSessions = [
    { sessionId: 'sess-1', title: 'Test Session', modelId: 'claude', threadStatus: 'idle', requests: [] },
  ];

  const mockSessionModel = {
    sessionId: 'sess-2',
    title: 'New Session',
    modelId: 'claude',
    threadStatus: 'working',
    requests: [{ message: { prompt: 'hello' } }],
  };

  function buildMockContainer() {
    const mockInternalService = {
      getSessions: jest.fn().mockReturnValue(mockSessions),
      createSessionModel: jest.fn().mockResolvedValue(undefined),
      activateSession: jest.fn().mockResolvedValue(undefined),
      clearSessionModel: jest.fn().mockResolvedValue(undefined),
      getAvailableCommands: jest.fn().mockReturnValue([
        { name: '/explain', description: 'Explain code' },
      ]),
      setSessionMode: jest.fn().mockResolvedValue(undefined),
      sessionModel: mockSessionModel,
    };

    const mockChatService = {
      sendMessage: jest.fn(),
      showChatView: jest.fn(),
    };

    const mockManagerService = {
      cancelRequest: jest.fn(),
    };

    const mockPermissionBridge = {
      getActiveDialogCount: jest.fn().mockReturnValue(0),
      getActiveSession: jest.fn().mockReturnValue('sess-2'),
    };

    return {
      get: jest.fn().mockImplementation((token) => {
        const tokenName = token?.toString?.() || String(token);
        if (tokenName.includes('ChatInternalService')) return mockInternalService;
        if (tokenName.includes('ChatService')) return mockChatService;
        if (tokenName.includes('ChatManagerService')) return mockManagerService;
        if (tokenName.includes('PermissionBridge')) return mockPermissionBridge;
        throw new Error('DI token not mocked');
      }),
    } as any;
  }

  beforeAll(() => {
    ensureModelContext();
    disposable = registerAcpWebMCPTools(buildMockContainer());
  });

  afterAll(() => disposable.dispose());

  describe('acp_listSessions', () => {
    it('returns sessions list', async () => {
      const result = await navigator.modelContext!.executeTool('acp_listSessions', {});
      expect(result).toMatchObject({
        success: true,
        result: [{ sessionId: 'sess-1', title: 'Test Session' }],
      });
    });
  });

  describe('acp_createSession', () => {
    it('creates a new session', async () => {
      const result = await navigator.modelContext!.executeTool('acp_createSession', {});
      expect(result).toMatchObject({
        success: true,
        result: { sessionId: 'sess-2', title: 'New Session' },
      });
    });
  });

  describe('acp_switchSession', () => {
    it('switches to specified session', async () => {
      const result = await navigator.modelContext!.executeTool('acp_switchSession', { sessionId: 'sess-1' });
      expect(result).toMatchObject({
        success: true,
        result: { sessionId: 'sess-2', title: 'New Session' },
      });
    });
  });

  describe('acp_getSessionState', () => {
    it('returns active session state with threadStatus', async () => {
      const result = await navigator.modelContext!.executeTool('acp_getSessionState', {});
      expect(result).toMatchObject({
        success: true,
        result: {
          sessionId: 'sess-2',
          threadStatus: 'working',
          requestCount: 1,
        },
      });
    });
  });

  describe('acp_sendMessage', () => {
    it('sends message to active session', async () => {
      const result = await navigator.modelContext!.executeTool('acp_sendMessage', { message: 'hello' });
      expect(result).toMatchObject({
        success: true,
        result: { sessionId: 'sess-2', status: 'message_sent' },
      });
    });

    it('sends message with command', async () => {
      const result = await navigator.modelContext!.executeTool('acp_sendMessage', {
        message: 'explain this',
        command: '/explain',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('acp_clearSession', () => {
    it('clears the active session', async () => {
      const result = await navigator.modelContext!.executeTool('acp_clearSession', {});
      expect(result).toMatchObject({ success: true });
    });
  });

  describe('acp_cancelRequest', () => {
    it('cancels the current request', async () => {
      const result = await navigator.modelContext!.executeTool('acp_cancelRequest', {});
      expect(result).toMatchObject({ success: true, result: { status: 'cancelled' } });
    });
  });

  describe('acp_getAvailableCommands', () => {
    it('returns available commands', async () => {
      const result = await navigator.modelContext!.executeTool('acp_getAvailableCommands', {});
      expect(result).toMatchObject({
        success: true,
        result: [{ name: '/explain', description: 'Explain code' }],
      });
    });
  });

  describe('acp_setSessionMode', () => {
    it('sets the session mode', async () => {
      const result = await navigator.modelContext!.executeTool('acp_setSessionMode', { modeId: 'agent' });
      expect(result).toMatchObject({ success: true, result: { modeId: 'agent' } });
    });
  });

  describe('acp_showChatView', () => {
    it('shows the chat view', async () => {
      const result = await navigator.modelContext!.executeTool('acp_showChatView', {});
      expect(result).toMatchObject({ success: true });
    });
  });

  describe('acp_getPermissionDialogState', () => {
    it('returns permission dialog state', async () => {
      const result = await navigator.modelContext!.executeTool('acp_getPermissionDialogState', {});
      expect(result).toMatchObject({
        success: true,
        result: { activeDialogCount: 0, activeSessionId: 'sess-2' },
      });
    });
  });

  describe('tool disposal', () => {
    it('returns TOOL_DISPOSED after dispose', async () => {
      disposable.dispose();
      const result = await navigator.modelContext!.executeTool('acp_listSessions', {});
      expect(result).toMatchObject({ success: false, error: 'TOOL_DISPOSED' });
    });
  });
});
