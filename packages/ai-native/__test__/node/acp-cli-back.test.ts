import { AgentProcessConfig, CancellationToken, Emitter } from '@opensumi/ide-core-common';
import { ChatReadableStream, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { AgentSessionInfo, AgentUpdate, IAcpAgentService } from '../../src/node/acp/acp-agent.service';
import { AcpCliBackService } from '../../src/node/acp/acp-cli-back.service';
import { OpenAICompatibleModel } from '../../src/node/openai-compatible/openai-compatible-language-model';

// Mock dependencies
jest.mock('../../src/node/openai-compatible/openai-compatible-language-model', () => ({
  OpenAICompatibleModel: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

describe('AcpCliBackService', () => {
  let service: AcpCliBackService;
  let mockAgentService: jest.Mocked<IAcpAgentService>;
  let mockLogger: jest.Mocked<INodeLogger>;
  let mockOpenAIModel: jest.Mocked<OpenAICompatibleModel>;

  const mockAgentSessionConfig: AgentProcessConfig = {
    command: 'npx',
    args: ['@anthropic-ai/claude-code@latest'],
    workspaceDir: '/test/workspace',
  };

  const mockSessionInfo: AgentSessionInfo = {
    sessionId: 'test-session-123',
    processId: 'proc-1',
    modes: [{ id: 'code', name: 'Code' }],
    status: 'ready',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAgentService = {
      createSession: jest.fn(),
      initializeAgent: jest.fn(),
      sendMessage: jest.fn(),
      cancelRequest: jest.fn(),
      disposeSession: jest.fn(),
      dispose: jest.fn(),
      getSessionInfo: jest.fn(),
      loadSession: jest.fn(),
      listSessions: jest.fn(),
      setSessionMode: jest.fn(),
      stopAgent: jest.fn(),
      getAvailableModes: jest.fn(),
    } as unknown as jest.Mocked<IAcpAgentService>;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      warn: jest.fn(),
      critical: jest.fn(),
      dispose: jest.fn(),
      getLevel: jest.fn(),
      setLevel: jest.fn(),
    } as unknown as jest.Mocked<INodeLogger>;

    mockOpenAIModel = {
      request: jest.fn(),
    } as unknown as jest.Mocked<OpenAICompatibleModel>;

    service = new AcpCliBackService();
    Object.defineProperty(service, 'agentService', { value: mockAgentService, writable: true });
    Object.defineProperty(service, 'logger', { value: mockLogger, writable: true });
    Object.defineProperty(service, 'openAICompatibleModel', { value: mockOpenAIModel, writable: true });
  });

  describe('ready()', () => {
    it('should always return true', async () => {
      const result = await service.ready();
      expect(result).toBe(true);
    });
  });

  describe('request()', () => {
    it('should return error code -1 indicating not supported', async () => {
      const result = await service.request('hello', {});
      expect(result.errorCode).toBe(-1);
      expect(result.errorMsg).toContain('not supported');
    });
  });

  describe('createSession()', () => {
    it('should create session via agentService', async () => {
      const expected = { sessionId: 'new-session', availableCommands: [{ name: '/help', description: 'Help' }] };
      mockAgentService.createSession.mockResolvedValue(expected);

      const result = await service.createSession(mockAgentSessionConfig);

      expect(result).toEqual(expected);
      expect(mockAgentService.createSession).toHaveBeenCalledWith(mockAgentSessionConfig);
    });

    it('should ensure agent initialized before creating session', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);
      mockAgentService.createSession.mockResolvedValue({ sessionId: 's1', availableCommands: [] });

      await service.createSession(mockAgentSessionConfig);

      expect(mockAgentService.getSessionInfo).toHaveBeenCalled();
      expect(mockAgentService.initializeAgent).not.toHaveBeenCalled();
    });

    it('should initialize agent when no existing session', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(null);
      mockAgentService.initializeAgent.mockResolvedValue(mockSessionInfo);
      mockAgentService.createSession.mockResolvedValue({ sessionId: 's1', availableCommands: [] });

      await service.createSession(mockAgentSessionConfig);

      expect(mockAgentService.initializeAgent).toHaveBeenCalledWith(mockAgentSessionConfig);
    });
  });

  describe('requestStream() - fallback to OpenAI', () => {
    it('should use OpenAI stream when agentSessionConfig is not provided', async () => {
      (mockOpenAIModel.request as jest.Mock).mockImplementation(async (_input, stream) => {
        stream.emitData({ kind: 'content', content: 'hello' });
        stream.end();
      });

      const stream = await service.requestStream('hello', {});

      expect(mockOpenAIModel.request).toHaveBeenCalled();
      expect(stream).toBeInstanceOf(ChatReadableStream);
    });
  });

  describe('requestStream() - agent mode', () => {
    it('should use agent stream when agentSessionConfig is provided', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const stream = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });

      expect(stream).toBeInstanceOf(SumiReadableStream);
      expect(mockAgentService.getSessionInfo).toHaveBeenCalled();
    });

    it('should forward agent updates to the output stream', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });

      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      // Simulate agent sending updates
      agentStream.emitData({ type: 'message', content: 'Hello from agent' });
      agentStream.emitData({ type: 'thought', content: 'Thinking...' });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData.length).toBe(2); // 'done' returns null
      expect(receivedData[0]).toEqual({ kind: 'content', content: 'Hello from agent' });
      expect(receivedData[1]).toEqual({ kind: 'reasoning', content: 'Thinking...' });
    });

    it('should emit error when agent stream fails', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });

      const receivedError: Error[] = [];
      output.onError((err) => receivedError.push(err));

      agentStream.emitError(new Error('Agent connection lost'));

      expect(receivedError.length).toBe(1);
      expect(receivedError[0].message).toBe('Agent connection lost');
    });

    it('should handle cancellation token', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const cancelEmitter = new Emitter<void>();
      const cancelToken = {
        isCancellationRequested: false,
        onCancellationRequested: cancelEmitter.event,
      } as CancellationToken;

      await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig }, cancelToken);

      cancelEmitter.fire();

      expect(mockAgentService.cancelRequest).toHaveBeenCalledWith(mockSessionInfo.sessionId);
    });

    it('should use provided sessionId from options instead of sessionInfo', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      await service.requestStream('prompt', {
        agentSessionConfig: mockAgentSessionConfig,
        sessionId: 'override-session-id',
      });

      expect(mockAgentService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'override-session-id' }),
        expect.any(Object),
      );
    });
  });

  describe('convertAgentUpdateToChatProgress()', () => {
    it('should convert "thought" update to reasoning progress', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({ type: 'thought', content: 'I think...' });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([{ kind: 'reasoning', content: 'I think...' }]);
    });

    it('should convert "message" update to content progress', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({ type: 'message', content: 'Answer text' });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([{ kind: 'content', content: 'Answer text' }]);
    });

    it('should convert "tool_result" update to content progress', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({ type: 'tool_result', content: 'Modified file.ts' });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([{ kind: 'content', content: 'Modified file.ts' }]);
    });

    it('should ignore "tool_call" and "done" updates', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({ type: 'tool_call', content: 'read_file' });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([]);
    });
  });

  describe('loadAgentSession()', () => {
    const mockSessionNotifications: any[] = [
      {
        sessionId: 'sess-1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: 'Hello agent' },
        },
      },
      {
        sessionId: 'sess-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Hi there!' },
        },
      },
    ];

    it('should load session and convert to messages', async () => {
      mockAgentService.loadSession.mockResolvedValue({
        sessionId: 'sess-1',
        processId: 'proc-1',
        modes: [],
        status: 'ready',
        historyUpdates: mockSessionNotifications,
      });

      const result = await service.loadAgentSession(mockAgentSessionConfig, 'sess-1');

      expect(result.sessionId).toBe('sess-1');
      expect(result.messages).toEqual([
        { role: 'user', content: 'Hello agent' },
        { role: 'assistant', content: 'Hi there!' },
      ]);
    });

    it('should handle load session error', async () => {
      mockAgentService.loadSession.mockRejectedValue(new Error('Session not found'));

      await expect(service.loadAgentSession(mockAgentSessionConfig, 'sess-1')).rejects.toThrow(
        'Failed to load session sess-1: Session not found',
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle non-Error throw', async () => {
      mockAgentService.loadSession.mockRejectedValue('string error');

      await expect(service.loadAgentSession(mockAgentSessionConfig, 'sess-1')).rejects.toThrow(
        'Failed to load session sess-1: string error',
      );
    });
  });

  describe('disposeSession()', () => {
    it('should cancel request then dispose session', async () => {
      await service.disposeSession('sess-1');

      expect(mockAgentService.cancelRequest).toHaveBeenCalledWith('sess-1');
      expect(mockAgentService.disposeSession).toHaveBeenCalledWith('sess-1');
    });

    it('should still complete even if disposeSession fails', async () => {
      mockAgentService.disposeSession.mockRejectedValue(new Error('dispose failed'));

      await service.disposeSession('sess-1');

      expect(mockAgentService.cancelRequest).toHaveBeenCalledWith('sess-1');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('cancelSession()', () => {
    it('should call agentService.cancelRequest', async () => {
      await service.cancelSession('sess-1');
      expect(mockAgentService.cancelRequest).toHaveBeenCalledWith('sess-1');
    });
  });

  describe('setSessionMode()', () => {
    it('should call agentService.setSessionMode with correct params', async () => {
      await service.setSessionMode('sess-1', 'code');

      expect(mockAgentService.setSessionMode).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        modeId: 'code',
      });
    });

    it('should re-throw error from agentService', async () => {
      const testError = new Error('Mode switch failed');
      mockAgentService.setSessionMode.mockRejectedValue(testError);

      await expect(service.setSessionMode('sess-1', 'code')).rejects.toThrow('Mode switch failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('listSessions()', () => {
    it('should initialize agent and list sessions', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);
      mockAgentService.listSessions.mockResolvedValue({
        sessions: [{ sessionId: 's1', cwd: '/test', title: 'Session 1' }],
        nextCursor: 'cursor-2',
      });

      const result = await service.listSessions(mockAgentSessionConfig);

      expect(mockAgentService.getSessionInfo).toHaveBeenCalled();
      expect(mockAgentService.listSessions).toHaveBeenCalledWith({
        cwd: mockAgentSessionConfig.workspaceDir,
      });
      expect(result.sessions).toHaveLength(1);
      expect(result.nextCursor).toBe('cursor-2');
    });

    it('should re-throw error from listSessions', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);
      mockAgentService.listSessions.mockRejectedValue(new Error('List failed'));

      await expect(service.listSessions(mockAgentSessionConfig)).rejects.toThrow('List failed');
    });

    it('should initialize agent when no existing session', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(null);
      mockAgentService.initializeAgent.mockResolvedValue(mockSessionInfo);
      mockAgentService.listSessions.mockResolvedValue({ sessions: [], nextCursor: undefined });

      await service.listSessions(mockAgentSessionConfig);

      expect(mockAgentService.initializeAgent).toHaveBeenCalledWith(mockAgentSessionConfig);
    });
  });

  describe('dispose()', () => {
    it('should call agentService.dispose', async () => {
      await service.dispose();
      expect(mockAgentService.dispose).toHaveBeenCalled();
    });

    it('should not dispose twice when called multiple times', async () => {
      await service.dispose();
      await service.dispose();

      expect(mockAgentService.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('OpenAI error handling', () => {
    it('should emit error on stream when OpenAI request fails', async () => {
      (mockOpenAIModel.request as jest.Mock).mockRejectedValue(new Error('API error'));

      const stream = await service.requestStream('hello', { apiKey: 'test-key' });

      const errors: Error[] = [];
      stream.onError((e) => errors.push(e));

      // Wait for async error to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('API error');
    });

    it('should wrap non-Error rejections into Error', async () => {
      (mockOpenAIModel.request as jest.Mock).mockRejectedValue('string error');

      const stream = await service.requestStream('hello', { apiKey: 'test-key' });

      const errors: Error[] = [];
      stream.onError((e) => errors.push(e));

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('string error');
    });
  });

  describe('requestStream() - with history and images', () => {
    it('should forward history to agentService.sendMessage', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const history = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' },
      ];

      await service.requestStream('new prompt', {
        agentSessionConfig: mockAgentSessionConfig,
        history: history as any,
      });

      expect(mockAgentService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          history,
        }),
        expect.any(Object),
      );
    });

    it('should handle empty history array', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      await service.requestStream('prompt', {
        agentSessionConfig: mockAgentSessionConfig,
        history: [],
      });

      expect(mockAgentService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ history: [] }),
        expect.any(Object),
      );
    });

    it('should forward images to agentService.sendMessage', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const images = ['data:image/png;base64,abc123'];

      await service.requestStream('what is this image?', {
        agentSessionConfig: mockAgentSessionConfig,
        images,
      });

      expect(mockAgentService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ images }),
        expect.any(Object),
      );
    });
  });

  describe('setupAgentStream error handling', () => {
    it('should emit error when ensureAgentInitialized throws', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(null);
      mockAgentService.initializeAgent.mockRejectedValue(new Error('Init failed'));

      const stream = await service.requestStream('prompt', {
        agentSessionConfig: mockAgentSessionConfig,
      });

      const errors: Error[] = [];
      stream.onError((e) => errors.push(e));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Init failed');
    });
  });

  describe('convertToSimpleMessage helper (indirect)', () => {
    it('should convert CoreMessage with array content to SimpleMessage', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const history = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Part one' },
            { type: 'text', text: 'Part two' },
          ],
        },
      ];

      await service.requestStream('prompt', {
        agentSessionConfig: mockAgentSessionConfig,
        history: history as any,
      });

      expect(mockAgentService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          history: [{ role: 'user', content: 'Part one\nPart two' }],
        }),
        expect.any(Object),
      );
    });

    it('should filter non-text content parts from array content', async () => {
      mockAgentService.getSessionInfo.mockReturnValue(mockSessionInfo);

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const history = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Keep this' },
            { type: 'image', url: 'http://example.com/img.png' },
            { type: 'text', text: 'And this' },
          ],
        },
      ];

      await service.requestStream('prompt', {
        agentSessionConfig: mockAgentSessionConfig,
        history: history as any,
      });

      expect(mockAgentService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          history: [{ role: 'user', content: 'Keep this\nAnd this' }],
        }),
        expect.any(Object),
      );
    });
  });
});
