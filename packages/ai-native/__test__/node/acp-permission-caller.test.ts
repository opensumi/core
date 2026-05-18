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

import {
  AcpPermissionCallerManager,
  AcpPermissionCallerManagerToken,
} from '../../src/node/acp/acp-permission-caller.service';

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

const mockRpcClient = {
  $showPermissionDialog: jest.fn(),
  $cancelRequest: jest.fn(),
};

describe('AcpPermissionCallerManager', () => {
  let manager: AcpPermissionCallerManager;

  beforeEach(() => {
    jest.clearAllMocks();

    (AcpPermissionCallerManager as any).currentRpcClient = null;

    manager = new AcpPermissionCallerManager();
    Object.defineProperty(manager, 'logger', { value: mockLogger, writable: true });
    Object.defineProperty(manager, 'client', { value: mockRpcClient, writable: true });
  });

  afterEach(() => {
    (AcpPermissionCallerManager as any).currentRpcClient = null;
  });

  describe('setConnectionClientId()', () => {
    it('should set clientId', () => {
      manager.setConnectionClientId('client-1');

      expect((manager as any).clientId).toBe('client-1');
    });

    it('should update static currentRpcClient via microtask', async () => {
      expect((AcpPermissionCallerManager as any).currentRpcClient).toBeNull();

      manager.setConnectionClientId('client-1');

      await Promise.resolve();

      expect((AcpPermissionCallerManager as any).currentRpcClient).toBe(mockRpcClient);
    });
  });

  describe('removeConnectionClientId()', () => {
    it('should clear clientId when matching', () => {
      manager.setConnectionClientId('client-1');
      manager.removeConnectionClientId('client-1');

      expect((manager as any).clientId).toBeUndefined();
    });
  });

  describe('requestPermission() - skip mode', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should return allow option when SKIP_PERMISSION_CHECK=true', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await manager.requestPermission({
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
        options: [
          { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' as const },
          { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' as const },
          { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' as const },
        ],
      });

      expect(result.outcome.outcome).toBe('selected');
      expect(mockRpcClient.$showPermissionDialog).not.toHaveBeenCalled();
    });

    it('should prefer allow_once over allow_always in skip mode', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await manager.requestPermission({
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
        options: [
          { optionId: 'allow_always', name: 'Always', kind: 'allow_always' as const },
          { optionId: 'allow_once', name: 'Once', kind: 'allow_once' as const },
        ],
      });

      expect((result.outcome as any).optionId).toBe('allow_once');
    });

    it('should fallback to first option in skip mode when no allow options', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await manager.requestPermission({
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
        options: [{ optionId: 'custom', name: 'Custom', kind: 'custom' as any }],
      });

      expect((result.outcome as any).optionId).toBe('custom');
    });

    it('should return empty string in skip mode when no options', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await manager.requestPermission({
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
        options: [],
      });

      expect((result.outcome as any).optionId).toBe('');
    });
  });

  describe('findAllowOptionId()', () => {
    it('should prefer allow_once', () => {
      const options = [
        { optionId: 'allow_always', name: 'Always', kind: 'allow_always' as const },
        { optionId: 'allow_once', name: 'Once', kind: 'allow_once' as const },
      ];

      const result = (manager as any).findAllowOptionId(options);
      expect(result).toBe('allow_once');
    });

    it('should fallback to allow_always if no allow_once', () => {
      const options = [{ optionId: 'allow_always', name: 'Always', kind: 'allow_always' as const }];

      const result = (manager as any).findAllowOptionId(options);
      expect(result).toBe('allow_always');
    });

    it('should fallback to first option if no allow options', () => {
      const options = [{ optionId: 'reject_once', name: 'Reject', kind: 'reject_once' as const }];

      const result = (manager as any).findAllowOptionId(options);
      expect(result).toBe('reject_once');
    });

    it('should return empty string for empty options', () => {
      const result = (manager as any).findAllowOptionId([]);
      expect(result).toBe('');
    });
  });

  describe('sortOptionsByKind()', () => {
    it('should sort in correct order', () => {
      const options = [
        { optionId: 'reject_once', kind: 'reject_once' as const },
        { optionId: 'allow_always', kind: 'allow_always' as const },
        { optionId: 'reject_always', kind: 'reject_always' as const },
        { optionId: 'allow_once', kind: 'allow_once' as const },
      ];

      const result = (manager as any).sortOptionsByKind(options);
      const kinds = result.map((o: any) => o.kind);
      expect(kinds).toEqual(['allow_always', 'allow_once', 'reject_always', 'reject_once']);
    });

    it('should not mutate original array', () => {
      const original = [
        { optionId: 'reject_once', kind: 'reject_once' as const },
        { optionId: 'allow_always', kind: 'allow_always' as const },
      ];

      (manager as any).sortOptionsByKind(original);

      expect(original[0].kind).toBe('reject_once');
    });

    it('should put unknown kinds at the end', () => {
      const options = [
        { optionId: 'unknown', kind: 'unknown' as any },
        { optionId: 'allow_once', kind: 'allow_once' as const },
      ];

      const result = (manager as any).sortOptionsByKind(options);
      expect(result[0].kind).toBe('allow_once');
      expect(result[1].kind).toBe('unknown');
    });
  });

  describe('requestPermission() - normal RPC flow', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.SKIP_PERMISSION_CHECK;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should call $showPermissionDialog with correct params', async () => {
      mockRpcClient.$showPermissionDialog.mockResolvedValue({ type: 'allow', optionId: 'allow_once' });

      const result = await manager.requestPermission({
        sessionId: 'sess-1',
        toolCall: {
          toolCallId: 'tc-1',
          title: 'Run Command',
          kind: 'execute',
          status: 'pending',
          locations: [{ path: '/src/test.ts', line: 10 }],
          rawInput: { command: 'npm test' },
        } as any,
        options: [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' as const }],
      });

      expect(mockRpcClient.$showPermissionDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'sess-1:tc-1',
          sessionId: 'sess-1',
          title: 'Run Command',
          kind: 'execute',
          content: expect.any(String),
          locations: [{ path: '/src/test.ts', line: 10 }],
          options: [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }],
          timeout: 60000,
        }),
      );
      expect(result.outcome.outcome).toBe('selected');
      expect((result.outcome as any).optionId).toBe('allow_once');
    });

    it('should build content with title, affected files, and command', async () => {
      mockRpcClient.$showPermissionDialog.mockResolvedValue({ type: 'allow' });

      await manager.requestPermission({
        sessionId: 'sess-1',
        toolCall: {
          toolCallId: 'tc-1',
          title: 'Edit File',
          kind: 'write',
          status: 'pending',
          locations: [{ path: '/src/a.ts' }, { path: '/src/b.ts' }],
          rawInput: { command: 'write to file' },
        } as any,
        options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' as const }],
      });

      const callArg = mockRpcClient.$showPermissionDialog.mock.calls[0][0];
      expect(callArg.content).toContain('Edit File');
      expect(callArg.content).toContain('Affected files: /src/a.ts, /src/b.ts');
      expect(callArg.content).toContain('Command: `write to file`');
    });

    it('should throw when no RPC client available', async () => {
      (AcpPermissionCallerManager as any).currentRpcClient = null;
      Object.defineProperty(manager, 'client', { value: null, writable: true });

      await expect(
        manager.requestPermission({
          sessionId: 'sess-1',
          toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
          options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' as const }],
        }),
      ).rejects.toThrow('[ACP Permission Caller] No active RPC client available');
    });

    it('should use static currentRpcClient as fallback', async () => {
      const staticClient = {
        $showPermissionDialog: jest.fn().mockResolvedValue({ type: 'allow' }),
        $cancelRequest: jest.fn(),
      };
      (AcpPermissionCallerManager as any).currentRpcClient = staticClient;
      Object.defineProperty(manager, 'client', { value: null, writable: true });

      await manager.requestPermission({
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
        options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' as const }],
      });

      expect(staticClient.$showPermissionDialog).toHaveBeenCalled();
    });
  });

  describe('buildPermissionResponse()', () => {
    const options = [
      { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' as const },
      { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' as const },
      { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' as const },
      { optionId: 'reject_always', name: 'Reject Always', kind: 'reject_always' as const },
    ];

    it('should return selected outcome for allow decision', () => {
      const result = (manager as any).buildPermissionResponse({ type: 'allow', optionId: 'allow_once' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('allow_once');
    });

    it('should return selected outcome for reject decision', () => {
      const result = (manager as any).buildPermissionResponse({ type: 'reject', optionId: 'reject_once' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('reject_once');
    });

    it('should auto-find optionId when not provided in allow decision', () => {
      const result = (manager as any).buildPermissionResponse({ type: 'allow' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('allow_once');
    });

    it('should auto-find optionId when not provided in reject decision', () => {
      const result = (manager as any).buildPermissionResponse({ type: 'reject' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('reject_once');
    });

    it('should return cancelled outcome for timeout decision', () => {
      const result = (manager as any).buildPermissionResponse({ type: 'timeout' }, options);
      expect(result.outcome.outcome).toBe('cancelled');
    });

    it('should return cancelled outcome for cancelled decision', () => {
      const result = (manager as any).buildPermissionResponse({ type: 'cancelled' }, options);
      expect(result.outcome.outcome).toBe('cancelled');
    });

    it('should return cancelled outcome for unknown decision type', () => {
      const result = (manager as any).buildPermissionResponse({ type: 'unknown' as any }, options);
      expect(result.outcome.outcome).toBe('cancelled');
    });
  });

  describe('findOptionId()', () => {
    const options = [
      { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' as const },
      { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' as const },
      { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' as const },
      { optionId: 'reject_always', name: 'Reject Always', kind: 'reject_always' as const },
    ];

    it('should find allow_once for allow decision', () => {
      const result = (manager as any).findOptionId('allow', options);
      expect(result).toBe('allow_once');
    });

    it('should find reject_once for reject decision', () => {
      const result = (manager as any).findOptionId('reject', options);
      expect(result).toBe('reject_once');
    });

    it('should fallback to allow_always when no allow_once', () => {
      const opts = options.filter((o) => o.kind !== 'allow_once');
      const result = (manager as any).findOptionId('allow', opts);
      expect(result).toBe('allow_always');
    });

    it('should fallback to prefix match when no exact kind match', () => {
      const opts = [{ optionId: 'allow_custom', name: 'Custom', kind: 'allow_custom' as any }];
      const result = (manager as any).findOptionId('allow', opts);
      expect(result).toBe('allow_custom');
    });

    it('should fallback to first option when no match', () => {
      const opts = [{ optionId: 'custom', name: 'Custom', kind: 'custom' as any }];
      const result = (manager as any).findOptionId('allow', opts);
      expect(result).toBe('custom');
    });

    it('should return empty string for empty options', () => {
      const result = (manager as any).findOptionId('allow', []);
      expect(result).toBe('');
    });
  });

  describe('cancelRequest()', () => {
    it('should call $cancelRequest on rpc client', async () => {
      mockRpcClient.$cancelRequest.mockResolvedValue(undefined);

      await manager.cancelRequest('req-123');

      expect(mockRpcClient.$cancelRequest).toHaveBeenCalledWith('req-123');
    });

    it('should use static currentRpcClient as fallback', async () => {
      const staticClient = {
        $showPermissionDialog: jest.fn(),
        $cancelRequest: jest.fn().mockResolvedValue(undefined),
      };
      (AcpPermissionCallerManager as any).currentRpcClient = staticClient;
      Object.defineProperty(manager, 'client', { value: null, writable: true });

      await manager.cancelRequest('req-456');

      expect(staticClient.$cancelRequest).toHaveBeenCalledWith('req-456');
    });

    it('should not throw when rpc client is unavailable', async () => {
      (AcpPermissionCallerManager as any).currentRpcClient = null;
      Object.defineProperty(manager, 'client', { value: null, writable: true });

      await expect(manager.cancelRequest('req-789')).resolves.not.toThrow();
    });

    it('should log error when $cancelRequest fails', async () => {
      mockRpcClient.$cancelRequest.mockRejectedValue(new Error('Network error'));

      await manager.cancelRequest('req-123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ACP Permission Caller] Failed to cancel request:',
        expect.any(Error),
      );
    });
  });

  describe('removeConnectionClientId() - edge cases', () => {
    it('should not clear clientId when mismatched', () => {
      manager.setConnectionClientId('client-1');
      manager.removeConnectionClientId('client-2');

      expect((manager as any).clientId).toBe('client-1');
    });

    it('should not clear static currentRpcClient when client mismatched', () => {
      const otherClient = { $showPermissionDialog: jest.fn(), $cancelRequest: jest.fn() };
      (AcpPermissionCallerManager as any).currentRpcClient = otherClient;

      manager.setConnectionClientId('client-1');
      manager.removeConnectionClientId('client-2');

      expect((AcpPermissionCallerManager as any).currentRpcClient).toBe(otherClient);
    });

    it('should clear static currentRpcClient when matching', async () => {
      manager.setConnectionClientId('client-1');
      await Promise.resolve();

      expect((AcpPermissionCallerManager as any).currentRpcClient).toBe(mockRpcClient);

      manager.removeConnectionClientId('client-1');

      expect((AcpPermissionCallerManager as any).currentRpcClient).toBeNull();
    });
  });
});
