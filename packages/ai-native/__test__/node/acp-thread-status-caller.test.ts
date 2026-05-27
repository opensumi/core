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

import { AcpThreadStatusCallerService } from '../../src/node/acp/acp-thread-status-caller.service';

const mockRpcClient = {
  $onThreadStatusChange: jest.fn().mockResolvedValue(undefined),
};

describe('AcpThreadStatusCallerService', () => {
  let service: AcpThreadStatusCallerService;

  beforeEach(() => {
    jest.clearAllMocks();
    AcpThreadStatusCallerService.staticRpcClient = undefined;
    service = new AcpThreadStatusCallerService();
    Object.defineProperty(service, 'rpcClient', { value: [mockRpcClient], writable: true });
  });

  afterEach(() => {
    AcpThreadStatusCallerService.staticRpcClient = undefined;
  });

  describe('notifyThreadStatusChange()', () => {
    it('should call $onThreadStatusChange on RPC client', () => {
      service.notifyThreadStatusChange('session-1', 'working');

      expect(mockRpcClient.$onThreadStatusChange).toHaveBeenCalledWith('session-1', 'working');
    });

    it('should forward different status values', () => {
      service.notifyThreadStatusChange('session-1', 'idle');
      expect(mockRpcClient.$onThreadStatusChange).toHaveBeenCalledWith('session-1', 'idle');

      service.notifyThreadStatusChange('session-2', 'awaiting_prompt');
      expect(mockRpcClient.$onThreadStatusChange).toHaveBeenCalledWith('session-2', 'awaiting_prompt');
    });

    it('should fall back to staticRpcClient when instance client is unavailable', () => {
      Object.defineProperty(service, 'rpcClient', { value: undefined, writable: true });
      const staticClient = { $onThreadStatusChange: jest.fn().mockResolvedValue(undefined) };
      AcpThreadStatusCallerService.staticRpcClient = staticClient as any;

      service.notifyThreadStatusChange('session-1', 'working');

      expect(staticClient.$onThreadStatusChange).toHaveBeenCalledWith('session-1', 'working');
    });

    it('should silently do nothing when no RPC client is available', () => {
      Object.defineProperty(service, 'rpcClient', { value: undefined, writable: true });

      expect(() => service.notifyThreadStatusChange('session-1', 'idle')).not.toThrow();
    });

    it('should silently ignore RPC call rejection', async () => {
      mockRpcClient.$onThreadStatusChange.mockRejectedValue(new Error('RPC disconnected'));

      expect(() => service.notifyThreadStatusChange('session-1', 'working')).not.toThrow();
    });
  });

  describe('staticRpcClient', () => {
    it('should set and clear static client', () => {
      const client = { $onThreadStatusChange: jest.fn() } as any;
      AcpThreadStatusCallerService.setStaticRpcClient(client);
      expect(AcpThreadStatusCallerService.staticRpcClient).toBe(client);

      AcpThreadStatusCallerService.setStaticRpcClient(undefined);
      expect(AcpThreadStatusCallerService.staticRpcClient).toBeUndefined();
    });
  });
});
