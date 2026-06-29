jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
  };
});

import {
  AcpPermissionRpcBridgeService,
  AcpThreadStatusRpcBridgeService,
  AcpWebMcpRpcBridgeService,
} from '../../src/node/acp/acp-browser-rpc-bridge.service';
import { AcpBrowserRpcRegistry } from '../../src/node/acp/acp-browser-rpc-registry';

function wireBridge<T extends object>(bridge: T, registry: AcpBrowserRpcRegistry, clientId: string): T {
  (bridge as any).browserRpcRegistry = registry;
  (bridge as any).clientId = clientId;
  return bridge;
}

describe('ACP browser RPC bridge services', () => {
  it('should register and unregister permission RPC clients', () => {
    const registry = new AcpBrowserRpcRegistry();
    const bridge = wireBridge(new AcpPermissionRpcBridgeService(), registry, 'client-1');
    const client = {
      $showPermissionDialog: jest.fn(),
      $cancelRequest: jest.fn(),
    };

    bridge.rpcClient = [client];
    expect(registry.getPermissionClient('client-1')).toBe(client);
    expect(registry.getPermissionClient()).toBe(client);

    bridge.dispose();
    expect(registry.getPermissionClient('client-1')).toBeUndefined();
  });

  it('should register and unregister thread status RPC clients', () => {
    const registry = new AcpBrowserRpcRegistry();
    const bridge = wireBridge(new AcpThreadStatusRpcBridgeService(), registry, 'client-1');
    const client = {
      $onThreadStatusChange: jest.fn(),
    };

    bridge.rpcClient = [client];
    expect(registry.getThreadStatusClient('client-1')).toBe(client);

    bridge.dispose();
    expect(registry.getThreadStatusClient('client-1')).toBeUndefined();
  });

  it('should register and unregister WebMCP RPC clients', () => {
    const registry = new AcpBrowserRpcRegistry();
    const bridge = wireBridge(new AcpWebMcpRpcBridgeService(), registry, 'client-1');
    const client = {
      $getGroupDefinitions: jest.fn(),
      $executeTool: jest.fn(),
    };

    bridge.rpcClient = [client];
    expect(registry.getWebMcpClient('client-1')).toBe(client);

    bridge.dispose();
    expect(registry.getWebMcpClient('client-1')).toBeUndefined();
  });

  it('should keep the newer client when an older bridge is disposed later', () => {
    const registry = new AcpBrowserRpcRegistry();
    const oldBridge = wireBridge(new AcpPermissionRpcBridgeService(), registry, 'client-1');
    const newBridge = wireBridge(new AcpPermissionRpcBridgeService(), registry, 'client-1');
    const oldClient = {
      $showPermissionDialog: jest.fn(),
      $cancelRequest: jest.fn(),
    };
    const newClient = {
      $showPermissionDialog: jest.fn(),
      $cancelRequest: jest.fn(),
    };

    oldBridge.rpcClient = [oldClient];
    newBridge.rpcClient = [newClient];
    oldBridge.dispose();

    expect(registry.getPermissionClient('client-1')).toBe(newClient);
  });
});
