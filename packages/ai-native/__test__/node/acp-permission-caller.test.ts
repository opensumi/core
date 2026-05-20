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
  AcpPermissionCallerManagerToken,
  AcpPermissionCallerService,
  AcpPermissionCallerServiceToken,
} from '../../src/node/acp/acp-permission-caller.service';

const mockRpcClient = {
  $showPermissionDialog: jest.fn(),
  $cancelRequest: jest.fn(),
};

describe('AcpPermissionCallerService', () => {
  let service: AcpPermissionCallerService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AcpPermissionCallerService();
    Object.defineProperty(service, 'rpcClient', { value: [mockRpcClient], writable: true });
  });

  describe('requestPermission() - skip mode', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should return allow option when SKIP_PERMISSION_CHECK=true', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await service.requestPermission(
        {
          sessionId: 'sess-1',
          toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
          options: [
            { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' as const },
            { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' as const },
            { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' as const },
          ],
        },
        'sess-1',
      );

      expect(result.outcome.outcome).toBe('selected');
      expect(mockRpcClient.$showPermissionDialog).not.toHaveBeenCalled();
    });

    it('should prefer allow_once over allow_always in skip mode', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await service.requestPermission(
        {
          sessionId: 'sess-1',
          toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
          options: [
            { optionId: 'allow_always', name: 'Always', kind: 'allow_always' as const },
            { optionId: 'allow_once', name: 'Once', kind: 'allow_once' as const },
          ],
        },
        'sess-1',
      );

      expect((result.outcome as any).optionId).toBe('allow_once');
    });

    it('should fallback to first option in skip mode when no allow options', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await service.requestPermission(
        {
          sessionId: 'sess-1',
          toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
          options: [{ optionId: 'custom', name: 'Custom', kind: 'custom' as any }],
        },
        'sess-1',
      );

      expect((result.outcome as any).optionId).toBe('custom');
    });

    it('should return empty string in skip mode when no options', async () => {
      process.env.SKIP_PERMISSION_CHECK = 'true';

      const result = await service.requestPermission(
        {
          sessionId: 'sess-1',
          toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
          options: [],
        },
        'sess-1',
      );

      expect((result.outcome as any).optionId).toBe('');
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

      const result = await service.requestPermission(
        {
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
        },
        'sess-1',
      );

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

      await service.requestPermission(
        {
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
        },
        'sess-1',
      );

      const callArg = mockRpcClient.$showPermissionDialog.mock.calls[0][0];
      expect(callArg.content).toContain('Edit File');
      expect(callArg.content).toContain('Affected files: /src/a.ts, /src/b.ts');
      expect(callArg.content).toContain('Command: `write to file`');
    });

    it('should throw when no RPC client available', async () => {
      Object.defineProperty(service, 'rpcClient', { value: undefined, writable: true });

      await expect(
        service.requestPermission(
          {
            sessionId: 'sess-1',
            toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
            options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' as const }],
          },
          'sess-1',
        ),
      ).rejects.toThrow('[ACP Permission Caller] No active RPC client available');
    });

    it('should use the provided sessionId for the dialog requestId', async () => {
      mockRpcClient.$showPermissionDialog.mockResolvedValue({ type: 'allow' });

      await service.requestPermission(
        {
          sessionId: 'sdk-session',
          toolCall: { toolCallId: 'tc-42', title: 'Test', kind: 'read', status: 'pending' } as any,
          options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' as const }],
        },
        'routed-session',
      );

      const callArg = mockRpcClient.$showPermissionDialog.mock.calls[0][0];
      expect(callArg.sessionId).toBe('routed-session');
      expect(callArg.requestId).toBe('routed-session:tc-42');
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
      const result = (service as any).buildPermissionResponse({ type: 'allow', optionId: 'allow_once' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('allow_once');
    });

    it('should return selected outcome for reject decision', () => {
      const result = (service as any).buildPermissionResponse({ type: 'reject', optionId: 'reject_once' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('reject_once');
    });

    it('should auto-find optionId when not provided in allow decision', () => {
      const result = (service as any).buildPermissionResponse({ type: 'allow' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('allow_once');
    });

    it('should auto-find optionId when not provided in reject decision', () => {
      const result = (service as any).buildPermissionResponse({ type: 'reject' }, options);
      expect(result.outcome.outcome).toBe('selected');
      expect(result.outcome.optionId).toBe('reject_once');
    });

    it('should return cancelled outcome for timeout decision', () => {
      const result = (service as any).buildPermissionResponse({ type: 'timeout' }, options);
      expect(result.outcome.outcome).toBe('cancelled');
    });

    it('should return cancelled outcome for cancelled decision', () => {
      const result = (service as any).buildPermissionResponse({ type: 'cancelled' }, options);
      expect(result.outcome.outcome).toBe('cancelled');
    });

    it('should return cancelled outcome for unknown decision type', () => {
      const result = (service as any).buildPermissionResponse({ type: 'unknown' as any }, options);
      expect(result.outcome.outcome).toBe('cancelled');
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

      const result = (service as any).sortOptionsByKind(options);
      const kinds = result.map((o: any) => o.kind);
      expect(kinds).toEqual(['allow_always', 'allow_once', 'reject_always', 'reject_once']);
    });

    it('should not mutate original array', () => {
      const original = [
        { optionId: 'reject_once', kind: 'reject_once' as const },
        { optionId: 'allow_always', kind: 'allow_always' as const },
      ];

      (service as any).sortOptionsByKind(original);

      expect(original[0].kind).toBe('reject_once');
    });

    it('should put unknown kinds at the end', () => {
      const options = [
        { optionId: 'unknown', kind: 'unknown' as any },
        { optionId: 'allow_once', kind: 'allow_once' as const },
      ];

      const result = (service as any).sortOptionsByKind(options);
      expect(result[0].kind).toBe('allow_once');
      expect(result[1].kind).toBe('unknown');
    });
  });

  describe('cancelRequest()', () => {
    it('should call $cancelRequest on rpc client', async () => {
      mockRpcClient.$cancelRequest.mockResolvedValue(undefined);

      await service.cancelRequest('req-123');

      expect(mockRpcClient.$cancelRequest).toHaveBeenCalledWith('req-123');
    });

    it('should not throw when rpc client is unavailable', async () => {
      Object.defineProperty(service, 'rpcClient', { value: undefined, writable: true });

      await expect(service.cancelRequest('req-789')).resolves.not.toThrow();
    });
  });

  describe('backward compatibility tokens', () => {
    it('AcpPermissionCallerManagerToken should equal AcpPermissionCallerServiceToken', () => {
      expect(AcpPermissionCallerManagerToken).toBe(AcpPermissionCallerServiceToken);
    });
  });
});
