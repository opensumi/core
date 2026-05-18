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

import { EventEmitter } from 'events';

import { ACP_PROTOCOL_VERSION, AcpCliClientService } from '../../src/node/acp/acp-cli-client.service';
import { AcpAgentRequestHandler } from '../../src/node/acp/handlers/agent-request.handler';

// Mock dependencies
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
  critical: jest.fn(),
  dispose: jest.fn(),
  getLevel: jest.fn(),
  setLevel: jest.fn(),
};

const mockAgentRequestHandler = {
  handleReadTextFile: jest.fn(),
  handleWriteTextFile: jest.fn(),
  handlePermissionRequest: jest.fn(),
  handleCreateTerminal: jest.fn(),
  handleTerminalOutput: jest.fn(),
  handleWaitForTerminalExit: jest.fn(),
  handleKillTerminal: jest.fn(),
  handleReleaseTerminal: jest.fn(),
};

describe('AcpCliClientService', () => {
  let service: AcpCliClientService;
  let mockStdin: any;
  let mockStdout: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStdin = new EventEmitter() as any;
    mockStdin.writable = true;
    mockStdin.write = jest.fn().mockReturnValue(true);
    mockStdin.end = jest.fn();

    mockStdout = new EventEmitter() as any;
    mockStdout.removeAllListeners = jest.fn();

    service = new AcpCliClientService();
    Object.defineProperty(service, 'logger', { value: mockLogger, writable: true });
    Object.defineProperty(service, 'agentRequestHandler', { value: mockAgentRequestHandler, writable: true });
  });

  function setTransport() {
    service.setTransport(mockStdout, mockStdin);
  }

  describe('setTransport()', () => {
    it('should set stdin/stdout and transition to connected state', () => {
      setTransport();
      expect(service.isConnected()).toBe(true);
    });

    it('should reject pending requests when reconnecting', () => {
      setTransport();

      // Simulate a pending request
      (service as any).pendingRequests.set(1, {
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      // Reconnect
      setTransport();

      expect((service as any).pendingRequests.size).toBe(0);
    });

    it('should clear request queue when reconnecting', () => {
      setTransport();

      (service as any).requestQueue = [{ method: 'test', params: {}, resolve: jest.fn(), reject: jest.fn() }];

      setTransport();

      expect((service as any).requestQueue).toEqual([]);
    });

    it('should remove old listeners before attaching new ones', () => {
      setTransport();
      // Reset mock count
      mockStdout.removeAllListeners.mockClear();
      // Reconnect - this should call removeAllListeners on the OLD stdout
      setTransport();

      expect(mockStdout.removeAllListeners).toHaveBeenCalled();
    });

    it('should reset protocol and capability state', () => {
      setTransport();
      (service as any).negotiatedProtocolVersion = 1;
      (service as any).agentCapabilities = { fs: true };

      setTransport();

      expect(service.getNegotiatedProtocolVersion()).toBeNull();
      expect(service.getAgentCapabilities()).toBeNull();
    });
  });

  describe('isConnected()', () => {
    it('should return false before transport is set', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true after setTransport', () => {
      setTransport();
      expect(service.isConnected()).toBe(true);
    });

    it('should return false after close', () => {
      setTransport();
      service.close();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('close()', () => {
    it('should clear handlers and streams', () => {
      setTransport();
      (service as any).notificationHandlers = [jest.fn()];
      (service as any).disconnectHandlers = [jest.fn()];

      service.close();

      expect((service as any).notificationHandlers).toEqual([]);
      expect((service as any).disconnectHandlers).toEqual([]);
      expect(mockStdout.removeAllListeners).toHaveBeenCalled();
      expect(mockStdin.end).toHaveBeenCalled();
    });

    it('should not throw when stdin.end fails', () => {
      setTransport();
      mockStdin.end.mockImplementation(() => {
        throw new Error('already closed');
      });

      expect(() => service.close()).not.toThrow();
    });
  });

  describe('handleDisconnect()', () => {
    it('should transition to disconnected state', () => {
      setTransport();
      service.handleDisconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should reject all pending requests', () => {
      setTransport();
      const reject = jest.fn();
      (service as any).pendingRequests.set(1, { resolve: jest.fn(), reject });
      (service as any).pendingRequests.set(2, { resolve: jest.fn(), reject });

      service.handleDisconnect();

      expect(reject).toHaveBeenCalledTimes(2);
      expect(reject).toHaveBeenCalledWith(new Error('Not connected to agent process'));
    });

    it('should reject all queued requests', () => {
      setTransport();
      const reject = jest.fn();
      (service as any).requestQueue = [{ method: 'test', params: {}, resolve: jest.fn(), reject }];

      service.handleDisconnect();

      expect(reject).toHaveBeenCalledWith(new Error('Not connected to agent process'));
    });

    it('should call disconnect handlers', () => {
      setTransport();
      const handler = jest.fn();
      service.onDisconnect(handler);

      service.handleDisconnect();

      expect(handler).toHaveBeenCalled();
    });

    it('should clear all state', () => {
      setTransport();
      (service as any).negotiatedProtocolVersion = 1;
      (service as any).agentCapabilities = {};
      (service as any).agentInfo = {};
      (service as any).authMethods = ['oauth'];
      (service as any).sessionModes = {};

      service.handleDisconnect();

      expect(service.getNegotiatedProtocolVersion()).toBeNull();
      expect(service.getAgentCapabilities()).toBeNull();
      expect(service.getAgentInfo()).toBeNull();
      expect(service.getAuthMethods()).toEqual([]);
      expect(service.getSessionModes()).toBeNull();
    });

    it('should be idempotent - no effect when already disconnected', () => {
      setTransport();
      service.handleDisconnect();

      const handler = jest.fn();
      service.onDisconnect(handler);
      service.handleDisconnect();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onDisconnect()', () => {
    it('should return unsubscribe function', () => {
      setTransport();
      const handler = jest.fn();
      const unsubscribe = service.onDisconnect(handler);

      unsubscribe();

      service.handleDisconnect();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onNotification()', () => {
    it('should return unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = service.onNotification(handler);

      unsubscribe();

      expect((service as any).notificationHandlers).not.toContain(handler);
    });
  });

  describe('initialize()', () => {
    it('should send initialize request and store protocol version', async () => {
      setTransport();

      const sendRequestSpy = jest.spyOn(service as any, 'sendRequest').mockResolvedValue({
        protocolVersion: ACP_PROTOCOL_VERSION,
        agentCapabilities: { fs: true },
        agentInfo: { name: 'test', version: '1.0' },
      });

      const result = await service.initialize();

      expect(result.protocolVersion).toBe(ACP_PROTOCOL_VERSION);
      expect(service.getNegotiatedProtocolVersion()).toBe(ACP_PROTOCOL_VERSION);
      expect(service.getAgentCapabilities()).toEqual({ fs: true });
      expect(service.getAgentInfo()).toEqual({ name: 'test', version: '1.0' });
      sendRequestSpy.mockRestore();
    });

    it('should throw if protocol version is higher than supported', async () => {
      setTransport();

      jest.spyOn(service as any, 'sendRequest').mockResolvedValue({
        protocolVersion: ACP_PROTOCOL_VERSION + 1,
      });

      jest.spyOn(service as any, 'close').mockResolvedValue(undefined);

      await expect(service.initialize()).rejects.toThrow('Unsupported protocol version');
    });

    it('should throw if not connected', async () => {
      await expect(service.initialize()).rejects.toThrow('Not connected to agent process');
    });

    it('should accept lower protocol version with warning', async () => {
      setTransport();

      jest.spyOn(service as any, 'sendRequest').mockResolvedValue({
        protocolVersion: ACP_PROTOCOL_VERSION - 1,
      });

      const result = await service.initialize();

      expect(result.protocolVersion).toBe(ACP_PROTOCOL_VERSION - 1);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('sendRequest()', () => {
    it('should throw if not connected', async () => {
      await expect((service as any).sendRequest('test', {})).rejects.toThrow('Not connected to agent process');
    });
  });

  describe('handleData() - NDJSON parsing', () => {
    it('should parse a single JSON-RPC response', () => {
      setTransport();
      const resolve = jest.fn();
      (service as any).pendingRequests.set(1, { resolve, reject: jest.fn() });

      mockStdout.emit('data', Buffer.from('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n'));

      expect(resolve).toHaveBeenCalledWith({ ok: true });
    });

    it('should parse multiple lines in one chunk', () => {
      setTransport();
      const resolve1 = jest.fn();
      const resolve2 = jest.fn();
      (service as any).pendingRequests.set(1, { resolve: resolve1, reject: jest.fn() });
      (service as any).pendingRequests.set(2, { resolve: resolve2, reject: jest.fn() });

      mockStdout.emit(
        'data',
        Buffer.from('{"jsonrpc":"2.0","id":1,"result":"a"}\n{"jsonrpc":"2.0","id":2,"result":"b"}\n'),
      );

      expect(resolve1).toHaveBeenCalledWith('a');
      expect(resolve2).toHaveBeenCalledWith('b');
    });

    it('should handle partial messages across chunks', () => {
      setTransport();
      const resolve = jest.fn();
      (service as any).pendingRequests.set(1, { resolve, reject: jest.fn() });

      // Send partial message
      mockStdout.emit('data', Buffer.from('{"jsonrpc":"2.0","id":1,'));
      expect(resolve).not.toHaveBeenCalled();

      // Complete the message
      mockStdout.emit('data', Buffer.from('"result":"done"}\n'));
      expect(resolve).toHaveBeenCalledWith('done');
    });

    it('should handle error responses', () => {
      setTransport();
      const reject = jest.fn();
      (service as any).pendingRequests.set(1, { resolve: jest.fn(), reject });

      mockStdout.emit(
        'data',
        Buffer.from('{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Invalid request"}}\n'),
      );

      expect(reject).toHaveBeenCalled();
      const error = reject.mock.calls[0][0];
      expect(error.message).toBe('Invalid request');
      expect((error as any).code).toBe(-32600);
    });

    it('should skip empty lines', () => {
      setTransport();
      const resolve = jest.fn();
      (service as any).pendingRequests.set(1, { resolve, reject: jest.fn() });

      mockStdout.emit('data', Buffer.from('\n\n{"jsonrpc":"2.0","id":1,"result":"ok"}\n\n'));

      expect(resolve).toHaveBeenCalledWith('ok');
    });

    it('should log error for invalid JSON', () => {
      setTransport();

      mockStdout.emit('data', Buffer.from('not json\n'));

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('handleIncomingNotification()', () => {
    it('should dispatch session/update to notification handlers', () => {
      setTransport();
      const handler = jest.fn();
      service.onNotification(handler);

      mockStdout.emit(
        'data',
        Buffer.from(
          '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s1","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Hello"}}}}\n',
        ),
      );

      expect(handler).toHaveBeenCalledWith({
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } },
      });
    });

    it('should update currentModeId on current_mode_update', () => {
      setTransport();
      (service as any).sessionModes = { currentModeId: 'old' };

      mockStdout.emit(
        'data',
        Buffer.from(
          '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s1","update":{"sessionUpdate":"current_mode_update","currentModeId":"code"}}}\n',
        ),
      );

      expect((service as any).sessionModes.currentModeId).toBe('code');
    });

    it('should warn if current_mode_update received but sessionModes not initialized', () => {
      setTransport();
      (service as any).sessionModes = null;

      mockStdout.emit(
        'data',
        Buffer.from(
          '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s1","update":{"sessionUpdate":"current_mode_update","currentModeId":"code"}}}\n',
        ),
      );

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('handleIncomingRequest()', () => {
    it('should route fs/read_text_file to handler', async () => {
      setTransport();
      mockAgentRequestHandler.handleReadTextFile.mockResolvedValue({ content: 'hello' });

      const writeSpy = jest.spyOn(mockStdin, 'write');

      mockStdout.emit(
        'data',
        Buffer.from(
          '{"jsonrpc":"2.0","id":1,"method":"fs/read_text_file","params":{"sessionId":"s1","path":"test.txt"}}\n',
        ),
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(mockAgentRequestHandler.handleReadTextFile).toHaveBeenCalledWith({
        sessionId: 's1',
        path: 'test.txt',
      });
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"result":{"content":"hello"}'));
    });

    it('should return method not found for unknown methods', async () => {
      setTransport();
      const writeSpy = jest.spyOn(mockStdin, 'write');

      mockStdout.emit('data', Buffer.from('{"jsonrpc":"2.0","id":1,"method":"unknown/method","params":{}}\n'));

      await new Promise((r) => setTimeout(r, 10));

      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"code":-32601'));
    });

    it('should send error response when handler throws', async () => {
      setTransport();
      mockAgentRequestHandler.handleReadTextFile.mockRejectedValue(new Error('read failed'));
      const writeSpy = jest.spyOn(mockStdin, 'write');

      mockStdout.emit(
        'data',
        Buffer.from(
          '{"jsonrpc":"2.0","id":1,"method":"fs/read_text_file","params":{"sessionId":"s1","path":"test.txt"}}\n',
        ),
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"error"'));
    });
  });

  describe('handleDisconnect on stdout events', () => {
    it('should handle stdout end event', () => {
      setTransport();
      const disconnectSpy = jest.spyOn(service, 'handleDisconnect');

      mockStdout.emit('end');

      expect(disconnectSpy).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle stdout error event', () => {
      setTransport();
      const disconnectSpy = jest.spyOn(service, 'handleDisconnect');

      mockStdout.emit('error', new Error('stream error'));

      expect(disconnectSpy).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('sendNotification()', () => {
    it('should send notification without id', () => {
      setTransport();
      service.cancel({ sessionId: 's1' });

      expect(mockStdin.write).toHaveBeenCalledWith(expect.stringContaining('"method":"session/cancel"'));
    });

    it('should not send notification when disconnected', () => {
      service.cancel({ sessionId: 's1' });
      expect(mockStdin.write).not.toHaveBeenCalled();
    });

    it('should handle write errors gracefully', () => {
      setTransport();
      mockStdin.write.mockImplementationOnce(() => {
        throw new Error('write failed');
      });

      expect(() => service.cancel({ sessionId: 's1' })).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getSessionModes()', () => {
    it('should return session modes after initialize', async () => {
      setTransport();
      jest.spyOn(service as any, 'sendRequest').mockResolvedValue({
        protocolVersion: ACP_PROTOCOL_VERSION,
        modes: { currentModeId: 'code', availableModes: [{ id: 'code', name: 'Code' }] },
      });

      await service.initialize();

      expect(service.getSessionModes()).toEqual({
        currentModeId: 'code',
        availableModes: [{ id: 'code', name: 'Code' }],
      });
    });
  });
});
