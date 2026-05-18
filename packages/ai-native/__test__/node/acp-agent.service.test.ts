jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
    Inject: noopDecorator,
    Optional: noopDecorator,
  };
});

import { AgentProcessConfig } from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpAgentService, AcpAgentServiceToken } from '../../src/node/acp/acp-agent.service';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from '../../src/node/acp/handlers/terminal.handler';

// Mock dependencies
const mockCliClientService = {
  setTransport: jest.fn(),
  initialize: jest.fn().mockResolvedValue(undefined),
  newSession: jest.fn().mockResolvedValue({
    sessionId: 'test-session-123',
    modes: { availableModes: [{ id: 'code', name: 'Code' }] },
  }),
  loadSession: jest.fn().mockResolvedValue({}),
  prompt: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  onNotification: jest.fn(() => jest.fn()) as any,
  onDisconnect: jest.fn(() => jest.fn()),
  listSessions: jest.fn(),
  setSessionMode: jest.fn(),
  getSessionModes: jest.fn(),
};

const mockProcessManager = {
  startAgent: jest.fn().mockResolvedValue({ processId: 'proc-1', stdout: {} as any, stdin: {} as any }),
  stopAgent: jest.fn().mockResolvedValue(undefined),
  killAgent: jest.fn().mockResolvedValue(undefined),
  killAllAgents: jest.fn().mockResolvedValue(undefined),
  isRunning: jest.fn(),
  getExitCode: jest.fn(),
  listRunningAgents: jest.fn(),
};

const mockTerminalHandler = {
  releaseSessionTerminals: jest.fn().mockResolvedValue(undefined),
};

const mockLogger: INodeLogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
  critical: jest.fn(),
  dispose: jest.fn(),
  getLevel: jest.fn(),
  setLevel: jest.fn(),
} as unknown as INodeLogger;

const mockAppConfig = {};

const mockAgentProcessConfig: AgentProcessConfig = {
  command: 'npx',
  args: ['@anthropic-ai/claude-code@latest'],
  workspaceDir: '/test/workspace',
};

function createService(): AcpAgentService {
  const service = new AcpAgentService();
  Object.defineProperty(service, 'clientService', { value: mockCliClientService, writable: true });
  Object.defineProperty(service, 'processManager', { value: mockProcessManager, writable: true });
  Object.defineProperty(service, 'terminalHandler', { value: mockTerminalHandler, writable: true });
  Object.defineProperty(service, 'appConfig', { value: mockAppConfig, writable: true });
  Object.defineProperty(service, 'logger', { value: mockLogger, writable: true });
  return service;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('AcpAgentService', () => {
  describe('getSessionInfo()', () => {
    it('should return null initially', () => {
      const service = createService();
      expect(service.getSessionInfo()).toBeNull();
    });

    it('should return session info after initializeAgent', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);
      const info = service.getSessionInfo();
      expect(info).not.toBeNull();
      expect(info?.sessionId).toBe('test-session-123');
      expect(info?.processId).toBe('proc-1');
      expect(info?.status).toBe('ready');
    });
  });

  describe('initializeAgent()', () => {
    it('should connect process, create session, and store sessionInfo', async () => {
      const service = createService();
      const result = await service.initializeAgent(mockAgentProcessConfig);

      expect(mockProcessManager.startAgent).toHaveBeenCalledWith(
        'npx',
        ['@anthropic-ai/claude-code@latest'],
        {},
        '/test/workspace',
      );
      expect(mockCliClientService.setTransport).toHaveBeenCalled();
      expect(mockCliClientService.initialize).toHaveBeenCalled();
      expect(mockCliClientService.newSession).toHaveBeenCalledWith({
        cwd: '/test/workspace',
        mcpServers: [],
      });
      expect(result.sessionId).toBe('test-session-123');
      expect(result.status).toBe('ready');
    });

    it('should return cached sessionInfo if already initialized', async () => {
      const service = createService();
      const first = await service.initializeAgent(mockAgentProcessConfig);
      const second = await service.initializeAgent(mockAgentProcessConfig);

      expect(first).toBe(second);
      expect(mockProcessManager.startAgent).toHaveBeenCalledTimes(1);
      expect(mockCliClientService.newSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendMessage()', () => {
    it('should return stream with error if not initialized', () => {
      const service = createService();
      const stream = service.sendMessage({ prompt: 'hello', sessionId: 'sess-1' });

      const errors: Error[] = [];
      stream.onError((e) => errors.push(e));

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Agent process not initialized');
    });

    it('should build prompt blocks with text and send prompt', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      service.sendMessage({ prompt: 'Hello world', sessionId: 'test-session-123' });

      expect(mockCliClientService.prompt).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        prompt: [{ type: 'text', text: 'Hello world' }],
      });
    });

    it('should handle agent_thought_chunk as thought', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      let notificationHandler: any;
      mockCliClientService.onNotification.mockImplementation((handler: any) => {
        notificationHandler = handler;
        return jest.fn();
      });

      const updates: any[] = [];
      const stream = service.sendMessage({ prompt: 'Hello', sessionId: 'test-session-123' });
      stream.onData((data) => updates.push(data));

      notificationHandler({
        sessionId: 'test-session-123',
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'I am thinking...' },
        },
      });

      expect(updates).toContainEqual({ type: 'thought', content: 'I am thinking...' });
    });

    it('should handle agent_message_chunk as message', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      let notificationHandler: any;
      mockCliClientService.onNotification.mockImplementation((handler: any) => {
        notificationHandler = handler;
        return jest.fn();
      });

      const updates: any[] = [];
      const stream = service.sendMessage({ prompt: 'Hello', sessionId: 'test-session-123' });
      stream.onData((data) => updates.push(data));

      notificationHandler({
        sessionId: 'test-session-123',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Here is my answer.' },
        },
      });

      expect(updates).toContainEqual({ type: 'message', content: 'Here is my answer.' });
    });

    it('should handle tool_call notifications', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      let notificationHandler: any;
      mockCliClientService.onNotification.mockImplementation((handler: any) => {
        notificationHandler = handler;
        return jest.fn();
      });

      const updates: any[] = [];
      const stream = service.sendMessage({ prompt: 'Hello', sessionId: 'test-session-123' });
      stream.onData((data) => updates.push(data));

      notificationHandler({
        sessionId: 'test-session-123',
        update: {
          sessionUpdate: 'tool_call',
          title: 'ReadFile',
          rawInput: { path: '/test/file.ts' },
        },
      });

      expect(updates).toContainEqual({
        type: 'tool_call',
        content: 'ReadFile',
        toolCall: { name: 'ReadFile', input: { path: '/test/file.ts' } },
      });
    });

    it('should handle tool_call_update with diff as tool_result', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      let notificationHandler: any;
      mockCliClientService.onNotification.mockImplementation((handler: any) => {
        notificationHandler = handler;
        return jest.fn();
      });

      const updates: any[] = [];
      const stream = service.sendMessage({ prompt: 'Hello', sessionId: 'test-session-123' });
      stream.onData((data) => updates.push(data));

      notificationHandler({
        sessionId: 'test-session-123',
        update: {
          sessionUpdate: 'tool_call_update',
          content: [{ type: 'diff', path: 'src/index.ts' }],
        },
      });

      expect(updates).toContainEqual({ type: 'tool_result', content: 'Modified src/index.ts' });
    });

    it('should filter notifications by sessionId', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      let notificationHandler: any;
      mockCliClientService.onNotification.mockImplementation((handler: any) => {
        notificationHandler = handler;
        return jest.fn();
      });

      const updates: any[] = [];
      const stream = service.sendMessage({ prompt: 'Hello', sessionId: 'test-session-123' });
      stream.onData((data) => updates.push(data));

      notificationHandler({
        sessionId: 'other-session',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Should be ignored' },
        },
      });

      expect(updates).not.toContainEqual({ type: 'message', content: 'Should be ignored' });
    });

    it('should include images in prompt blocks', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      const imageData = 'data:image/png;base64,iVBORw0KGgo=';
      service.sendMessage({ prompt: 'Look at this', sessionId: 'test-session-123', images: [imageData] });

      expect(mockCliClientService.prompt).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        prompt: [
          { type: 'text', text: 'Look at this' },
          { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' },
        ],
      });
    });
  });

  describe('cancelRequest()', () => {
    it('should call clientService.cancel', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      await service.cancelRequest('test-session-123');

      expect(mockCliClientService.cancel).toHaveBeenCalledWith({ sessionId: 'test-session-123' });
    });

    it('should return early if process not initialized', async () => {
      const service = createService();
      await service.cancelRequest('test-session-123');

      expect(mockCliClientService.cancel).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should swallow errors', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      mockCliClientService.cancel.mockRejectedValue(new Error('Cancel failed'));

      await expect(service.cancelRequest('test-session-123')).resolves.toBeUndefined();
    });
  });

  describe('stopAgent()', () => {
    it('should stop process, close client, and clear state', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      await service.stopAgent();

      expect(mockProcessManager.stopAgent).toHaveBeenCalled();
      expect(mockCliClientService.close).toHaveBeenCalled();
      expect(service.getSessionInfo()).toBeNull();
    });

    it('should be no-op if process not initialized', async () => {
      const service = createService();
      await service.stopAgent();

      expect(mockProcessManager.stopAgent).not.toHaveBeenCalled();
      expect(mockCliClientService.close).not.toHaveBeenCalled();
    });
  });

  describe('dispose()', () => {
    it('should unsubscribe disconnect handler, stop handler, and kill agents', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      await service.dispose();

      expect(mockProcessManager.killAllAgents).toHaveBeenCalled();
      expect(service.getSessionInfo()).toBeNull();
    });

    it('should be no-op when called twice', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      await service.dispose();
      await service.dispose();

      expect(mockProcessManager.stopAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadSession()', () => {
    it('should set sessionInfo after loading', async () => {
      const service = createService();

      mockCliClientService.onNotification.mockReturnValue(jest.fn());

      await service.loadSession('sess-1', mockAgentProcessConfig);

      const info = service.getSessionInfo();
      expect(info).not.toBeNull();
      expect(info?.sessionId).toBe('sess-1');
    });
  });

  describe('listSessions()', () => {
    it('should delegate to clientService.listSessions', async () => {
      const service = createService();
      const expected = {
        sessions: [{ sessionId: 's1', cwd: '/test', title: 'Session 1' }],
        nextCursor: 'cursor-2',
      };
      mockCliClientService.listSessions.mockResolvedValue(expected);

      const result = await service.listSessions({ cwd: '/test' });

      expect(result).toEqual(expected);
    });
  });

  describe('setSessionMode()', () => {
    it('should delegate to clientService.setSessionMode', async () => {
      const service = createService();

      await service.setSessionMode({ sessionId: 'sess-1', modeId: 'code' });

      expect(mockCliClientService.setSessionMode).toHaveBeenCalledWith({ sessionId: 'sess-1', modeId: 'code' });
    });
  });

  describe('disposeSession()', () => {
    it('should call terminalHandler.releaseSessionTerminals', async () => {
      const service = createService();

      await service.disposeSession('sess-1');

      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('sess-1');
    });
  });

  describe('getAvailableModes()', () => {
    it('should delegate to clientService.getSessionModes', async () => {
      const service = createService();
      const expected = { availableModes: [{ id: 'code', name: 'Code' }], defaultModeId: 'code' };
      mockCliClientService.getSessionModes.mockResolvedValue(expected);

      const result = await service.getAvailableModes();

      expect(result).toEqual(expected);
    });
  });

  describe('parseDataUrl()', () => {
    it('should extract mimeType and base64Data from data URLs', () => {
      const service = createService();
      const result = (service as any).parseDataUrl('data:image/png;base64,helloWorld');
      expect(result).toEqual({ mimeType: 'image/png', base64Data: 'helloWorld' });
    });

    it('should return default mimeType for non-data URLs', () => {
      const service = createService();
      const result = (service as any).parseDataUrl('not-a-data-url');
      expect(result).toEqual({ mimeType: 'image/jpeg', base64Data: 'not-a-data-url' });
    });
  });

  describe('disconnect handling', () => {
    it('should clear state on disconnect', async () => {
      const service = createService();
      await service.initializeAgent(mockAgentProcessConfig);

      const onDisconnectCall = (mockCliClientService.onDisconnect as any).mock.calls[0];
      const disconnectHandler = onDisconnectCall[0];

      disconnectHandler();

      expect(service.getSessionInfo()).toBeNull();
      expect(service['currentProcessId']).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('[AcpAgentService] Connection lost, clearing state');
    });
  });
});
