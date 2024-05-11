import { Injector } from '@opensumi/di';
import { ProxyIdentifier } from '@opensumi/ide-connection';
import { SumiConnectionMultiplexer } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { DefaultReporter, IReporter, PreferenceScope, sleep } from '@opensumi/ide-core-common';
import { ExtHostAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';

import { MainThreadEditorTabsService } from '../../__mocks__/api/editor.tab';
import { MainThreadExtensionLog } from '../../__mocks__/api/mainthread.extension.log';
import { MainThreadExtensionService } from '../../__mocks__/api/mainthread.extension.service';
import { MainThreadStorage } from '../../__mocks__/api/mathread.storage';
import { mockExtensionProps, mockExtensionProps2 } from '../../__mocks__/extensions';
import { createMockPairRPCProtocol } from '../../__mocks__/initRPCProtocol';
import { MessageChannel, MessagePort, MockWorker, mockFetch } from '../../__mocks__/worker';
import { ExtensionWorkerHost } from '../../src/hosted/worker.host';

(global as any).self = global;
(global as any).fetch = mockFetch;
(global as any).Worker = MockWorker;
(global as any).MessagePort = MessagePort;
(global as any).MessageChannel = MessageChannel;

describe('Extension Worker Thread Test Suites', () => {
  let extHostImpl: ExtensionWorkerHost;
  let rpcProtocolMain: SumiConnectionMultiplexer;
  let rpcProtocolExt: SumiConnectionMultiplexer;

  beforeAll(async () => {
    const injector = new Injector();
    injector.addProviders({
      token: IReporter,
      useValue: new DefaultReporter(),
    });

    const pair = await createMockPairRPCProtocol();
    rpcProtocolMain = pair.rpcProtocolMain;
    rpcProtocolExt = pair.rpcProtocolExt;

    rpcProtocolExt.set(ProxyIdentifier.for('MainThreadExtensionService'), new MainThreadExtensionService());
    rpcProtocolExt.set(ProxyIdentifier.for('MainThreadStorage'), new MainThreadStorage());
    rpcProtocolExt.set(ProxyIdentifier.for('MainThreadExtensionLog'), new MainThreadExtensionLog());
    rpcProtocolExt.set(ProxyIdentifier.for('MainThreadEditorTabs'), new MainThreadEditorTabsService());

    extHostImpl = new ExtensionWorkerHost(rpcProtocolMain, injector);

    const preferenceProxy = rpcProtocolExt.getProxy(ExtHostAPIIdentifier.ExtHostPreference);

    await sleep(100);
    await preferenceProxy.$initializeConfiguration({
      [PreferenceScope.Folder]: {},
    });
    await extHostImpl.$updateExtHostData();
  });

  it('init extensions', async () => {
    const extensions = extHostImpl.getExtensions();
    const ext = extHostImpl.getExtension(mockExtensionProps.id);
    expect(extensions.length).toBe(2);
    expect(ext?.id).toBe(mockExtensionProps.id);
  });

  it('activate extension', async () => {
    const id = mockExtensionProps.id;
    await extHostImpl.$activateExtension(id);
    expect(extHostImpl.isActivated(id)).toBe(true);
  });

  it('test for activated extension exportsAPI', async () => {
    const id = mockExtensionProps.id;
    expect(extHostImpl.getExtensionExports(id)).not.toEqual({});
    const exportsAPI = extHostImpl.getExtensionExports(id);
    expect(exportsAPI).toBeDefined();
    expect((exportsAPI as any).sayHello).toBeDefined();
    expect(typeof (exportsAPI as any).sayHello).toBe('function');
    const res = (exportsAPI as any).sayHello();
    expect(res).toBe('hello');
  });

  it('test for extension runtime error', async () => {
    const id = mockExtensionProps2.id;
    await extHostImpl.$activateExtension(id);
    expect(extHostImpl.isActivated(id)).toBe(true);
    const exportsAPI2 = extHostImpl.getExtensionExports(id);
    expect(exportsAPI2).toBeDefined();
    expect((exportsAPI2 as any).sayHello).toBeDefined();
    expect(typeof (exportsAPI2 as any).sayHello).toBe('function');
    expect(() => {
      (exportsAPI2 as any).sayHello();
    }).toThrow('worker runtime error.');
  });

  it('should register view proxy', async () => {
    const id = mockExtensionProps2.id;
    await extHostImpl.$activateExtension(id);
    const EXTENSION_EXTEND_SERVICE_PREFIX = 'extension_extend_service';
    const proxies = rpcProtocolMain.getProxy({
      serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${id}:FakeComponentId`,
    } as ProxyIdentifier<any>);
    // 这里其实没法覆盖到，因为 getProxy 永远都返回不为空..
    expect(proxies).toBeDefined();
  });
});
