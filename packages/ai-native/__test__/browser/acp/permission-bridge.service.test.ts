import { Emitter } from '@opensumi/ide-core-common';

import {
  AcpPermissionBridgeService,
  ShowPermissionDialogParams,
} from '../../../lib/browser/acp/permission-bridge.service';

// Mock @opensumi/di to make decorators no-ops
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

// Mock dependencies
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
};

const mockMainLayoutService = {};

describe('AcpPermissionBridgeService', () => {
  let service: AcpPermissionBridgeService;

  const mockParams: ShowPermissionDialogParams = {
    requestId: 'req-001',
    title: 'Test permission',
    kind: 'write',
    content: 'Edit file.txt',
    locations: [{ path: '/workspace/file.txt' }],
    options: [
      { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
      { optionId: 'reject_once', name: 'Reject', kind: 'reject_once' },
    ],
    timeout: 5000,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    service = new AcpPermissionBridgeService();
    Object.defineProperty(service, 'logger', { value: mockLogger, writable: true });
    Object.defineProperty(service, 'mainLayoutService', { value: mockMainLayoutService, writable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('showPermissionDialog()', () => {
    it('should return cancelled if dialog already exists for requestId', async () => {
      const promise1 = service.showPermissionDialog(mockParams);
      const promise2 = service.showPermissionDialog(mockParams);

      expect(await promise2).toEqual({ type: 'cancelled' });
    });

    it('should fire onDidRequestPermission event', async () => {
      const receivedParams: ShowPermissionDialogParams[] = [];
      service.onDidRequestPermission((params) => receivedParams.push(params));

      service.showPermissionDialog(mockParams);

      expect(receivedParams).toHaveLength(1);
      expect(receivedParams[0].requestId).toBe('req-001');
    });

    it('should resolve with allow when user decides allow_once', async () => {
      const promise = service.showPermissionDialog(mockParams);

      service.handleUserDecision('req-001', 'allow_once', 'allow_once');

      const result = await promise;
      expect(result).toEqual({
        type: 'allow',
        optionId: 'allow_once',
        always: false,
      });
    });

    it('should resolve with reject when user decides reject_once', async () => {
      const promise = service.showPermissionDialog(mockParams);

      service.handleUserDecision('req-001', 'reject_once', 'reject_once');

      const result = await promise;
      expect(result).toEqual({
        type: 'reject',
        optionId: 'reject_once',
        always: false,
      });
    });

    it('should resolve with allow and always=true for allow_always', async () => {
      const promise = service.showPermissionDialog(mockParams);

      service.handleUserDecision('req-001', 'allow_always', 'allow_always');

      const result = await promise;
      expect(result.type).toBe('allow');
      expect(result.always).toBe(true);
    });

    it('should fire onDidReceivePermissionResult on user decision', async () => {
      const results: any[] = [];
      service.onDidReceivePermissionResult((result) => results.push(result));

      const promise = service.showPermissionDialog(mockParams);
      service.handleUserDecision('req-001', 'allow_once', 'allow_once');
      await promise;

      expect(results).toHaveLength(1);
      expect(results[0].requestId).toBe('req-001');
      expect(results[0].decision.type).toBe('allow');
    });
  });

  describe('handleDialogClose()', () => {
    it('should resolve with timeout when dialog closes', async () => {
      const promise = service.showPermissionDialog(mockParams);

      service.handleDialogClose('req-001');

      const result = await promise;
      expect(result).toEqual({ type: 'timeout' });
    });

    it('should do nothing when no pending decision', () => {
      // Should not throw
      service.handleDialogClose('non-existent-id');
    });

    it('should fire onDidReceivePermissionResult with timeout decision', async () => {
      const results: any[] = [];
      service.onDidReceivePermissionResult((result) => results.push(result));

      const promise = service.showPermissionDialog(mockParams);
      service.handleDialogClose('req-001');
      await promise;

      expect(results).toHaveLength(1);
      expect(results[0].decision.type).toBe('timeout');
    });
  });

  describe('cancelRequest()', () => {
    it('should resolve with timeout (same as handleDialogClose)', async () => {
      const promise = service.showPermissionDialog(mockParams);

      service.cancelRequest('req-001');

      const result = await promise;
      expect(result).toEqual({ type: 'timeout' });
    });
  });

  describe('getActiveDialogCount()', () => {
    it('should return 0 initially', () => {
      expect(service.getActiveDialogCount()).toBe(0);
    });

    it('should return correct count with active dialogs', () => {
      service.showPermissionDialog(mockParams);
      expect(service.getActiveDialogCount()).toBe(1);

      service.handleUserDecision('req-001', 'allow_once', 'allow_once');
      expect(service.getActiveDialogCount()).toBe(0);
    });
  });

  describe('getActiveDialogs()', () => {
    it('should return empty array initially', () => {
      expect(service.getActiveDialogs()).toEqual([]);
    });

    it('should return active dialog props', () => {
      service.showPermissionDialog(mockParams);

      const dialogs = service.getActiveDialogs();
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0].requestId).toBe('req-001');
      expect(dialogs[0].visible).toBe(true);
    });
  });
});
