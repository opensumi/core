import { AcpPermissionRpcService } from '../../../lib/browser/acp/acp-permission-rpc.service';
import { AcpPermissionBridgeService } from '../../../lib/browser/acp/permission-bridge.service';

// Mock dependencies
const mockBridgeService = {
  showPermissionDialog: jest.fn(),
  handleUserDecision: jest.fn(),
  handleDialogClose: jest.fn(),
  cancelRequest: jest.fn(),
  onDidRequestPermission: jest.fn(),
  onDidReceivePermissionResult: jest.fn(),
  getActiveDialogCount: jest.fn(),
  getActiveDialogs: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
};

describe('AcpPermissionRpcService', () => {
  let service: AcpPermissionRpcService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AcpPermissionRpcService();
    Object.defineProperty(service, 'permissionBridgeService', { value: mockBridgeService, writable: true });
    Object.defineProperty(service, 'logger', { value: mockLogger, writable: true });
  });

  describe('$showPermissionDialog()', () => {
    it('should forward params to bridge service and return decision', async () => {
      const params = {
        requestId: 'req-001',
        title: 'Test title',
        kind: 'write',
        content: 'Test content',
        locations: [{ path: '/workspace/file.txt', line: 10 }],
        command: undefined,
        options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' }],
        timeout: 30000,
      };

      mockBridgeService.showPermissionDialog.mockResolvedValue({
        type: 'allow',
        optionId: 'opt-1',
        always: false,
      });

      const result = await service.$showPermissionDialog(params);

      expect(mockBridgeService.showPermissionDialog).toHaveBeenCalledWith({
        requestId: 'req-001',
        title: 'Test title',
        kind: 'write',
        content: 'Test content',
        locations: [{ path: '/workspace/file.txt', line: 10 }],
        command: undefined,
        options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' }],
        timeout: 30000,
      });
      expect(result).toEqual({ type: 'allow', optionId: 'opt-1', always: false });
    });

    it('should return cancelled on error', async () => {
      const params = {
        requestId: 'req-002',
        title: 'Test title',
        kind: 'write',
        content: 'Test content',
        options: [],
        timeout: 30000,
      };

      mockBridgeService.showPermissionDialog.mockRejectedValue(new Error('Bridge error'));

      const result = await service.$showPermissionDialog(params);

      expect(result).toEqual({ type: 'cancelled' });
    });
  });

  describe('$cancelRequest()', () => {
    it('should forward cancel request to bridge service', async () => {
      await service.$cancelRequest('req-001');

      expect(mockBridgeService.cancelRequest).toHaveBeenCalledWith('req-001');
    });
  });
});
