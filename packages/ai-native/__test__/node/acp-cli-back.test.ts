import { AgentProcessConfig, CancellationToken, Emitter } from '@opensumi/ide-core-common';
import { ChatReadableStream, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { toAgentUpdate } from '../../src/node/acp/acp-agent-update-adapter';
import { AgentSessionInfo, AgentUpdate, IAcpAgentService } from '../../src/node/acp/acp-agent.service';
import { AcpCliBackService } from '../../src/node/acp/acp-cli-back.service';
import { AcpThreadStatusCallerService } from '../../src/node/acp/acp-thread-status-caller.service';
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
    agentId: 'test-agent',
    command: 'npx',
    args: ['@anthropic-ai/claude-code@latest'],
    cwd: '/test/workspace',
  };

  const mockSessionInfo: AgentSessionInfo = {
    sessionId: 'test-session-123',
    processId: 'proc-1',
    modes: [{ id: 'code', name: 'Code' }],
    status: 'ready',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const mockOnThreadStatusChange = new Emitter<{ sessionId: string; status: string }>();

    mockAgentService = {
      createSession: jest.fn(),
      initializeAgent: jest.fn(),
      sendMessage: jest.fn(),
      cancelRequest: jest.fn(),
      disposeSession: jest.fn(),
      closeSession: jest.fn(),
      dispose: jest.fn(),
      getSessionInfo: jest.fn(),
      loadSession: jest.fn(),
      loadSessionOrNew: jest.fn(),
      listSessions: jest.fn(),
      setSessionMode: jest.fn(),
      stopAgent: jest.fn(),
      getAvailableModes: jest.fn(),
      getOpenSumiMcpServerConnection: jest.fn(),
      onThreadStatusChange: mockOnThreadStatusChange.event,
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
    Object.defineProperty(service, 'threadStatusCaller', {
      value: { notifyThreadStatusChange: jest.fn() },
      writable: true,
    });
  });

  describe('ready()', () => {
    it('should always return true', async () => {
      const result = await service.ready();
      expect(result).toBe(true);
    });
  });

  describe('getOpenSumiMcpServerConnection()', () => {
    it('should proxy the built-in MCP connection descriptor from AcpAgentService', async () => {
      const connection = {
        name: 'opensumi-ide',
        type: 'http',
        transport: 'streamable-http',
        url: 'http://127.0.0.1:12345/mcp/token',
        redactedUrl: 'http://127.0.0.1:12345/mcp/<redacted>',
        headers: [],
      } as any;
      mockAgentService.getOpenSumiMcpServerConnection.mockResolvedValue(connection);

      await expect(service.getOpenSumiMcpServerConnection()).resolves.toBe(connection);
      expect(mockAgentService.getOpenSumiMcpServerConnection).toHaveBeenCalled();
    });
  });

  describe('request()', () => {
    it('should collect OpenAI-compatible stream content when agent config is not provided', async () => {
      (mockOpenAIModel.request as jest.Mock).mockImplementation(async (_input, stream: ChatReadableStream) => {
        stream.emitData({ kind: 'content', content: 'hello' });
        stream.emitData({ kind: 'content', content: ' world' });
        stream.end();
      });

      const result = await service.request('hello', {});

      expect(result).toEqual({
        errorCode: 0,
        data: 'hello world',
      });
      expect(mockOpenAIModel.request).toHaveBeenCalled();
    });

    it('should create an ephemeral ACP session, collect message updates, and force dispose it', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'summary-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const resultPromise = service.request('summarize this', {
        agentSessionConfig: mockAgentSessionConfig,
        noTool: true,
        type: 'acp_chat_relay_summary',
      });

      agentStream.emitData({ type: 'thought', content: 'thinking' });
      agentStream.emitData({ type: 'message', content: 'summary ' });
      agentStream.emitData({ type: 'message', content: 'text' });
      agentStream.emitData({ type: 'done', content: '' });

      await expect(resultPromise).resolves.toEqual({
        errorCode: 0,
        data: 'summary text',
      });
      expect(mockAgentService.createSession).toHaveBeenCalledWith({
        ...mockAgentSessionConfig,
        mcpServers: [],
      });
      expect(mockAgentService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'summary-session',
          prompt: expect.stringContaining('summarize this'),
        }),
        expect.any(Object),
      );
      expect(mockAgentService.closeSession).toHaveBeenCalledWith({ sessionId: 'summary-session' });
      expect(mockAgentService.disposeSession).toHaveBeenCalledWith('summary-session', true);
    });

    it('should strip MCP servers for no-tool ACP requests', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'summary-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const resultPromise = service.request('summarize this', {
        agentSessionConfig: {
          ...mockAgentSessionConfig,
          mcpServers: [{ name: 'test', command: 'node', args: ['server.js'], env: [] }],
        },
        noTool: true,
      });

      agentStream.emitData({ type: 'message', content: 'summary' });
      agentStream.emitData({ type: 'done', content: '' });

      await resultPromise;

      expect(mockAgentService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpServers: [],
        }),
      );
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
  });

  describe('loadSessionOrNew()', () => {
    it('should return the session id resolved by agentService', async () => {
      mockAgentService.loadSessionOrNew.mockResolvedValue({
        sessionId: 'actual-session-id',
        processId: 'proc-1',
        modes: [],
        status: 'ready',
        historyUpdates: [],
      });

      const result = await service.loadSessionOrNew(mockAgentSessionConfig, 'requested-session-id');

      expect(result.sessionId).toBe('actual-session-id');
      expect(mockAgentService.loadSessionOrNew).toHaveBeenCalledWith('requested-session-id', mockAgentSessionConfig);
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
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const stream = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });

      expect(stream).toBeInstanceOf(SumiReadableStream);
      expect(mockAgentService.createSession).toHaveBeenCalledWith(mockAgentSessionConfig);
    });

    it('should forward agent updates to the output stream', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
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
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });

      const receivedError: Error[] = [];
      output.onError((err) => receivedError.push(err));

      agentStream.emitError(new Error('Agent connection lost'));

      expect(receivedError.length).toBe(1);
      expect(receivedError[0].message).toBe('Agent connection lost');
    });

    it('should preserve message from agent stream error objects', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });

      const receivedError: Error[] = [];
      output.onError((err) => receivedError.push(err));

      agentStream.emitError({
        code: -32603,
        message: 'Internal error: API Error: 422 provider config not found',
        data: { errorKind: 'unknown' },
      } as any);

      expect(receivedError.length).toBe(1);
      expect(receivedError[0].message).toBe('Internal error: API Error: 422 provider config not found');
      expect((receivedError[0] as any).code).toBe(-32603);
      expect((receivedError[0] as any).data).toEqual({ errorKind: 'unknown' });
    });

    it('should handle cancellation token', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const cancelEmitter = new Emitter<void>();
      const cancelToken = {
        isCancellationRequested: false,
        onCancellationRequested: cancelEmitter.event,
      } as CancellationToken;

      await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig }, cancelToken);

      cancelEmitter.fire();

      expect(mockAgentService.cancelRequest).toHaveBeenCalledWith('new-session');
    });

    it('should use provided sessionId from options instead of creating new session', async () => {
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
    it('should convert native current_mode_update to a session_state update', () => {
      expect(
        toAgentUpdate({
          sessionId: 'sess-1',
          update: {
            sessionUpdate: 'current_mode_update',
            currentModeId: 'code',
          },
        } as any),
      ).toEqual({
        type: 'session_state',
        content: '',
        sessionId: 'sess-1',
        currentModeId: 'code',
      });
    });

    it('should convert native config_option_update to a session_state update', () => {
      const configOptions = [{ id: 'permission', name: 'Permission', currentValue: 'default' }];

      expect(
        toAgentUpdate({
          sessionId: 'sess-1',
          update: {
            sessionUpdate: 'config_option_update',
            configOptions,
          },
        } as any),
      ).toEqual({
        type: 'session_state',
        content: '',
        sessionId: 'sess-1',
        configOptions,
      });
    });

    it('should convert native top-level plan entries to plan update content', () => {
      expect(
        toAgentUpdate({
          sessionId: 'sess-1',
          update: {
            sessionUpdate: 'plan',
            entries: [
              { content: 'BDD plan: prepare deterministic stream', status: 'completed', priority: 'high' },
              { content: 'BDD plan: emit tool update', status: 'in_progress', priority: 'medium' },
            ],
          },
        } as any),
      ).toEqual({
        type: 'plan',
        content: '- [x] BDD plan: prepare deterministic stream\n- [ ] BDD plan: emit tool update\n\n',
      });
    });

    it('should convert "thought" update to reasoning progress', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
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
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({ type: 'message', content: 'Answer text' });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([{ kind: 'content', content: 'Answer text' }]);
    });

    it('should convert "session_state" update to sessionState progress', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      const configOptions = [{ id: 'permission', name: 'Permission', currentValue: 'default' }];
      agentStream.emitData({
        type: 'session_state',
        content: '',
        sessionId: 'sess-1',
        currentModeId: 'code',
        currentModelId: 'qwen3.6-plus',
        configOptions,
      });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([
        {
          kind: 'sessionState',
          sessionId: 'sess-1',
          currentModeId: 'code',
          currentModelId: 'qwen3.6-plus',
          configOptions,
        },
      ]);
    });

    it('should convert "tool_result" update to content progress', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({ type: 'tool_result', content: 'Modified file.ts' });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([{ kind: 'content', content: 'Modified file.ts' }]);
    });

    it('should convert "tool_call" update to toolCall progress and ignore "done"', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({
        type: 'tool_call',
        content: 'read_file',
        toolCall: { toolCallId: 'tc-1', name: 'read_file', input: {} },
      });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([
        {
          kind: 'toolCall',
          content: {
            id: 'tc-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{}' },
            state: 'complete',
          },
        },
      ]);
    });

    it('should update cached tool_call arguments from "tool_call_args" updates', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      const output = await service.requestStream('prompt', { agentSessionConfig: mockAgentSessionConfig });
      const receivedData: any[] = [];
      output.onData((data) => receivedData.push(data));

      agentStream.emitData({
        type: 'tool_call',
        content: 'read_file',
        toolCall: { toolCallId: 'tc-1', name: 'read_file', input: {} },
      });
      agentStream.emitData({
        type: 'tool_call_args',
        content: '',
        toolCall: { toolCallId: 'tc-1', name: 'read_file', input: { path: '/test/file.ts' } },
      });
      agentStream.emitData({
        type: 'tool_result',
        content: 'file contents',
        toolCall: { toolCallId: 'tc-1', name: 'read_file', status: 'completed' },
      });
      agentStream.emitData({ type: 'done', content: '' });

      expect(receivedData).toEqual([
        {
          kind: 'toolCall',
          content: {
            id: 'tc-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{}' },
            state: 'complete',
          },
        },
        {
          kind: 'toolCall',
          content: {
            id: 'tc-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"/test/file.ts"}' },
            state: 'complete',
          },
        },
        {
          kind: 'toolCall',
          content: {
            id: 'tc-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"/test/file.ts"}' },
            result: 'file contents',
            state: 'result',
          },
        },
      ]);
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

    it('should ignore non-message native history updates when restoring messages', async () => {
      mockAgentService.loadSession.mockResolvedValue({
        sessionId: 'sess-1',
        processId: 'proc-1',
        modes: [],
        status: 'ready',
        historyUpdates: [
          ...mockSessionNotifications,
          {
            sessionId: 'sess-1',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'tc-1',
              status: 'completed',
              content: [{ type: 'diff', path: 'src/index.ts' }],
            },
          },
          {
            sessionId: 'sess-1',
            update: {
              sessionUpdate: 'usage_update',
              used: 10,
              size: 100,
            },
          },
        ],
      });

      const result = await service.loadAgentSession(mockAgentSessionConfig, 'sess-1');

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

    it('should stringify object-shaped load session errors', async () => {
      mockAgentService.loadSession.mockRejectedValue({
        code: -32603,
        error: {
          message: 'Session load failed',
        },
      });

      await expect(service.loadAgentSession(mockAgentSessionConfig, 'sess-1')).rejects.toThrow(
        'Failed to load session sess-1: Session load failed',
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
    it('should list sessions via agentService', async () => {
      mockAgentService.listSessions.mockResolvedValue({
        sessions: [{ sessionId: 's1', cwd: '/test', title: 'Session 1' } as any],
        nextCursor: 'cursor-2',
      });

      const result = await service.listSessions(mockAgentSessionConfig);

      expect(mockAgentService.listSessions).toHaveBeenCalledWith(
        {
          cwd: mockAgentSessionConfig.cwd,
        },
        mockAgentSessionConfig,
      );
      expect(result.sessions).toHaveLength(1);
      expect(result.nextCursor).toBe('cursor-2');
    });

    it('should re-throw error from listSessions', async () => {
      mockAgentService.listSessions.mockRejectedValue(new Error('List failed'));

      await expect(service.listSessions(mockAgentSessionConfig)).rejects.toThrow('List failed');
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
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
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
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
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
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
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
    it('should emit error when createSession throws', async () => {
      mockAgentService.createSession.mockRejectedValue(new Error('Session creation failed'));

      const stream = await service.requestStream('prompt', {
        agentSessionConfig: mockAgentSessionConfig,
      });

      const errors: Error[] = [];
      stream.onError((e) => errors.push(e));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Session creation failed');
    });
  });

  describe('convertToSimpleMessage helper (indirect)', () => {
    it('should convert CoreMessage with array content to SimpleMessage', async () => {
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
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
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'new-session', availableCommands: [] });
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

  describe('thread status subscription', () => {
    let mockOnThreadStatusChange: Emitter<{ sessionId: string; status: string }>;
    let mockThreadStatusCaller: { notifyThreadStatusChange: jest.Mock };

    beforeEach(() => {
      mockOnThreadStatusChange = new Emitter<{ sessionId: string; status: string }>();
      mockThreadStatusCaller = { notifyThreadStatusChange: jest.fn() };

      (mockAgentService as any).onThreadStatusChange = mockOnThreadStatusChange.event;
      Object.defineProperty(service, 'threadStatusCaller', { value: mockThreadStatusCaller, writable: true });
    });

    afterEach(() => {
      mockOnThreadStatusChange.dispose();
    });

    it('should subscribe to onThreadStatusChange on first agentRequestStream', async () => {
      const stream = new SumiReadableStream();
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.createSession.mockResolvedValue({ sessionId: 'sess-1', availableCommands: [] });
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      await service.requestStream('hello', {
        agentSessionConfig: mockAgentSessionConfig,
        sessionId: 'sess-1',
      });

      // Fire a thread status event
      mockOnThreadStatusChange.fire({ sessionId: 'sess-1', status: 'idle' });

      expect(mockThreadStatusCaller.notifyThreadStatusChange).toHaveBeenCalledWith('sess-1', 'idle');
    });

    it('should not create duplicate subscriptions on subsequent calls', async () => {
      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      await service.requestStream('hello', {
        agentSessionConfig: mockAgentSessionConfig,
        sessionId: 'sess-1',
      });

      await service.requestStream('hello again', {
        agentSessionConfig: mockAgentSessionConfig,
        sessionId: 'sess-1',
      });

      // Fire one event — should only be forwarded once
      mockOnThreadStatusChange.fire({ sessionId: 'sess-1', status: 'working' });

      expect(mockThreadStatusCaller.notifyThreadStatusChange).toHaveBeenCalledTimes(1);
    });

    it('should silently skip if threadStatusCaller is unavailable', async () => {
      Object.defineProperty(service, 'threadStatusCaller', { value: undefined, writable: true });

      const agentStream = new SumiReadableStream<AgentUpdate>();
      mockAgentService.sendMessage.mockReturnValue(agentStream);

      await service.requestStream('hello', {
        agentSessionConfig: mockAgentSessionConfig,
        sessionId: 'sess-1',
      });

      // Should not throw
      mockOnThreadStatusChange.fire({ sessionId: 'sess-1', status: 'idle' });
    });
  });
});
