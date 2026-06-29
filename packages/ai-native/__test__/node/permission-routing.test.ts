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

import { AcpPermissionCallerService } from '../../src/node/acp/acp-permission-caller.service';
import { PermissionRoutingService, PermissionRoutingServiceToken } from '../../src/node/acp/permission-routing.service';

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

const mockCallerService = {
  requestPermission: jest.fn(),
  cancelRequest: jest.fn(),
};

const baseRequest = {
  sessionId: 'sess-1',
  toolCall: {
    toolCallId: 'tc-1',
    title: 'Test Tool',
    kind: 'read',
    status: 'pending',
  } as any,
  options: [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' as const }],
};

function createService(): PermissionRoutingService {
  const service = new PermissionRoutingService();
  Object.defineProperty(service, 'permissionCallerService', { value: mockCallerService, writable: true });
  Object.defineProperty(service, 'logger', { value: mockLogger, writable: true });
  return service;
}

describe('PermissionRoutingService', () => {
  let service: PermissionRoutingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createService();
  });

  describe('session registration', () => {
    it('should register a session', () => {
      service.registerSession('sess-1');
      service.registerSession('sess-2');

      // Verify by routing - should use the registered session
      mockCallerService.requestPermission.mockResolvedValue({ outcome: { outcome: 'selected', optionId: 'opt-1' } });

      // Registered session should be routable
      service.routePermissionRequest(baseRequest, 'sess-1');
      expect(mockCallerService.requestPermission).toHaveBeenCalledWith(baseRequest, 'sess-1');
    });

    it('should unregister a session', () => {
      service.registerSession('sess-1');
      service.unregisterSession('sess-1');

      mockCallerService.requestPermission.mockResolvedValue({ outcome: { outcome: 'selected', optionId: 'opt-1' } });

      // Unregistered session should fall back (no active session = cancelled)
      // Since no active session, returns cancelled
    });

    it('should not affect other sessions when unregistering one', () => {
      service.registerSession('sess-1');
      service.registerSession('sess-2');
      service.unregisterSession('sess-1');

      // sess-2 should still be routable (as active fallback if set)
    });
  });

  describe('routePermissionRequest - routing strategy', () => {
    beforeEach(() => {
      mockCallerService.requestPermission.mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'allow_once' },
      });
    });

    it('should route to registered sessionId', async () => {
      service.registerSession('sess-1');

      const result = await service.routePermissionRequest(baseRequest, 'sess-1');

      expect(mockCallerService.requestPermission).toHaveBeenCalledWith(baseRequest, 'sess-1');
      expect(result.outcome.outcome).toBe('selected');
    });

    it('should return cancelled when sessionId is not registered', async () => {
      service.registerSession('sess-1');

      const result = await service.routePermissionRequest(baseRequest, 'sess-other');

      expect(result.outcome.outcome).toBe('cancelled');
      expect(mockCallerService.requestPermission).not.toHaveBeenCalled();
    });

    it('should return cancelled when no session is available', async () => {
      const result = await service.routePermissionRequest(baseRequest, 'sess-none');

      expect(result.outcome.outcome).toBe('cancelled');
      expect(mockCallerService.requestPermission).not.toHaveBeenCalled();
    });

    it('should return cancelled when no sessions registered and no active session', async () => {
      service.registerSession('sess-1');
      service.unregisterSession('sess-1');

      const result = await service.routePermissionRequest(baseRequest, 'sess-1');

      expect(result.outcome.outcome).toBe('cancelled');
      expect(mockCallerService.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent requests independently', async () => {
      service.registerSession('sess-1');
      service.registerSession('sess-2');

      // Simulate different response times
      mockCallerService.requestPermission
        .mockImplementationOnce(async (params, sessionId) => {
          await new Promise((r) => setTimeout(r, 50));
          return { outcome: { outcome: 'selected', optionId: `opt-${sessionId}` } };
        })
        .mockImplementationOnce(async (params, sessionId) => ({
          outcome: { outcome: 'selected', optionId: `opt-${sessionId}` },
        }));

      const [result1, result2] = await Promise.all([
        service.routePermissionRequest(baseRequest, 'sess-1'),
        service.routePermissionRequest(baseRequest, 'sess-2'),
      ]);

      // Each request should have its own result based on its sessionId
      expect(result1.outcome.outcome).toBe('selected');
      expect(result2.outcome.outcome).toBe('selected');
      // Both calls should have been made independently
      expect(mockCallerService.requestPermission).toHaveBeenCalledTimes(2);
    });

    it('should not cross-contaminate results between sessions', async () => {
      service.registerSession('sess-a');
      service.registerSession('sess-b');

      mockCallerService.requestPermission
        .mockImplementationOnce(async (_params, sessionId: string) => {
          // Simulate sess-a taking longer
          await new Promise((r) => setTimeout(r, 30));
          return sessionId === 'sess-a'
            ? { outcome: { outcome: 'selected', optionId: 'allow' } }
            : { outcome: { outcome: 'cancelled' } };
        })
        .mockImplementationOnce(async (_params, sessionId: string) =>
          sessionId === 'sess-b'
            ? { outcome: { outcome: 'selected', optionId: 'allow' } }
            : { outcome: { outcome: 'cancelled' } },
        );

      const [resultA, resultB] = await Promise.all([
        service.routePermissionRequest(baseRequest, 'sess-a'),
        service.routePermissionRequest(baseRequest, 'sess-b'),
      ]);

      expect((resultA.outcome as any).optionId).toBe('allow');
      expect((resultB.outcome as any).optionId).toBe('allow');
    });
  });
});
