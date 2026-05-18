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
});
