import { Emitter } from '@opensumi/ide-core-common';

import {
  AcpPermissionBridgeService,
  ShowPermissionDialogParams,
} from '../../../src/browser/acp/permission-bridge.service';
import { PermissionDialogManager } from '../../../src/browser/acp/permission-dialog-container';

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

describe('AcpPermissionBridgeService - session binding', () => {
  let service: AcpPermissionBridgeService;

  const mockParams: ShowPermissionDialogParams = {
    requestId: 'session-1:tool-1',
    sessionId: 'session-1',
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

  describe('setActiveSession / getActiveSession', () => {
    it('should track the active session', () => {
      service.setActiveSession('session-1');
      expect(service.getActiveSession()).toBe('session-1');

      service.setActiveSession('session-2');
      expect(service.getActiveSession()).toBe('session-2');
    });

    it('should return undefined initially', () => {
      expect(service.getActiveSession()).toBeUndefined();
    });

    it('should accept undefined to clear session', () => {
      service.setActiveSession('session-1');
      service.setActiveSession(undefined);
      expect(service.getActiveSession()).toBeUndefined();
    });
  });

  describe('onActiveSessionChange', () => {
    it('should fire event when session changes', () => {
      const listener = jest.fn();
      const dispose = service.onActiveSessionChange(listener);

      service.setActiveSession('session-1');
      expect(listener).toHaveBeenCalledWith('session-1');

      dispose.dispose();
    });

    it('should not fire event when session is the same', () => {
      const listener = jest.fn();
      const dispose = service.onActiveSessionChange(listener);

      service.setActiveSession('session-1');
      expect(listener).toHaveBeenCalledTimes(1);

      service.setActiveSession('session-1');
      expect(listener).toHaveBeenCalledTimes(1);

      dispose.dispose();
    });

    it('should fire with undefined when clearing session', () => {
      const listener = jest.fn();
      const dispose = service.onActiveSessionChange(listener);

      service.setActiveSession('session-1');
      service.setActiveSession(undefined);
      expect(listener).toHaveBeenLastCalledWith(undefined);

      dispose.dispose();
    });
  });

  describe('showPermissionDialog without auto-timeout', () => {
    it('should not auto-resolve after timeout period', async () => {
      service.setActiveSession('session-1');

      const promise = service.showPermissionDialog({
        ...mockParams,
        requestId: 'session-1:tool-timeout',
        timeout: 100, // 100ms - should NOT auto-resolve
      });

      // Advance time beyond the timeout
      jest.advanceTimersByTime(200);

      // The promise should still be pending
      expect((service as any).pendingDecisions.has('session-1:tool-timeout')).toBe(true);

      // Now manually resolve
      service.handleDialogClose('session-1:tool-timeout');
      const result = await promise;
      expect(result.type).toBe('timeout');
    });

    it('should persist dialog until explicitly resolved', async () => {
      service.setActiveSession('session-1');

      const promise = service.showPermissionDialog({
        ...mockParams,
        requestId: 'session-1:tool-persist',
        timeout: 60000, // 60s default
      });

      // Advance time by 60 seconds - dialog should still be pending
      jest.advanceTimersByTime(60000);
      expect((service as any).pendingDecisions.has('session-1:tool-persist')).toBe(true);

      // Advance another 60 seconds - still pending
      jest.advanceTimersByTime(60000);
      expect((service as any).pendingDecisions.has('session-1:tool-persist')).toBe(true);

      // Resolve manually
      service.handleUserDecision('session-1:tool-persist', 'allow_once', 'allow_once');
      const result = await promise;
      expect(result.type).toBe('allow');
    });
  });
});

describe('PermissionDialogManager - session-scoped dialogs', () => {
  let manager: PermissionDialogManager;

  const makeParams = (sessionId: string, toolId: string): ShowPermissionDialogParams => ({
    requestId: `${sessionId}:${toolId}`,
    sessionId,
    title: `Test ${toolId}`,
    kind: 'write',
    options: [],
    timeout: 5000,
  });

  beforeEach(() => {
    manager = new PermissionDialogManager();
  });

  describe('getDialogsForSession', () => {
    it('should return empty array for undefined sessionId', () => {
      manager.addDialog(makeParams('session-1', 'tool-1'));
      expect(manager.getDialogsForSession(undefined)).toEqual([]);
    });

    it('should return only dialogs for the specified session', () => {
      manager.addDialog(makeParams('session-1', 'tool-1'));
      manager.addDialog(makeParams('session-2', 'tool-2'));
      manager.addDialog(makeParams('session-1', 'tool-3'));

      const dialogs = manager.getDialogsForSession('session-1');
      expect(dialogs).toHaveLength(2);
      expect(dialogs[0].params.sessionId).toBe('session-1');
      expect(dialogs[1].params.sessionId).toBe('session-1');
    });

    it('should return empty array when no dialogs match session', () => {
      manager.addDialog(makeParams('session-1', 'tool-1'));
      expect(manager.getDialogsForSession('session-99')).toEqual([]);
    });
  });

  describe('clearDialogsForSession', () => {
    it('should remove all dialogs for the specified session', () => {
      manager.addDialog(makeParams('session-1', 'tool-1'));
      manager.addDialog(makeParams('session-2', 'tool-2'));
      manager.addDialog(makeParams('session-1', 'tool-3'));

      manager.clearDialogsForSession('session-1');

      const remaining = manager.getDialogs();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].params.sessionId).toBe('session-2');
    });

    it('should do nothing for undefined sessionId', () => {
      manager.addDialog(makeParams('session-1', 'tool-1'));
      manager.clearDialogsForSession(undefined);
      expect(manager.getDialogs()).toHaveLength(1);
    });

    it('should notify listeners after clearing', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      manager.addDialog(makeParams('session-1', 'tool-1'));
      manager.clearDialogsForSession('session-1');

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
