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

import { AcpBrowserRpcRegistry } from '../../src/node/acp/acp-browser-rpc-registry';
import { AcpThreadStatusCallerService } from '../../src/node/acp/acp-thread-status-caller.service';

const mockRpcClient = {
  $onThreadStatusChange: jest.fn().mockResolvedValue(undefined),
};

describe('AcpThreadStatusCallerService', () => {
  let service: AcpThreadStatusCallerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AcpThreadStatusCallerService();
    Object.defineProperty(service, 'rpcClient', { value: [mockRpcClient], writable: true });
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

    it('should fall back to registered browser RPC client when instance client is unavailable', () => {
      Object.defineProperty(service, 'rpcClient', { value: undefined, writable: true });
      const registry = new AcpBrowserRpcRegistry();
      const registeredClient = { $onThreadStatusChange: jest.fn().mockResolvedValue(undefined) };
      registry.registerThreadStatusClient('client-1', registeredClient as any);
      (service as any).browserRpcRegistry = registry;

      service.notifyThreadStatusChange('session-1', 'working');

      expect(registeredClient.$onThreadStatusChange).toHaveBeenCalledWith('session-1', 'working');
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
});
