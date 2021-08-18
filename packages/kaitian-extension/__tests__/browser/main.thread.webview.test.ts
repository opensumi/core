import { ExtHostWebviewViews, ExtHostWebviewService } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.api.webview';
import { MainThreadWebview, MainThreadWebviewView } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.api.webview';
import { mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ILoggerManagerClient } from '@ali/ide-logs';
import { Emitter, makeRandomHexString, IEventBus, Disposable, CancellationTokenSource, CommandRegistry } from '@ali/ide-core-common';
import { IWebviewService, IWebview } from '@ali/ide-webview';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { IExtHostWebview, ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '../../lib/common/vscode';
import { WebviewViewShouldShowEvent } from '@ali/ide-kaitian-extension/lib/browser/components/extension-webview-view';
import { WebviewViewProvider, WebviewView } from '@ali/ide-kaitian-extension/lib/common/vscode/webview';
import { IExtensionDescription, ExtensionIdentifier } from '@ali/ide-kaitian-extension/lib/common/vscode';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { IIconService } from '@ali/ide-theme';
import { StaticResourceService } from '@ali/ide-static-resource';
import { IOpenerService } from '@ali/ide-core-browser/lib/opener';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { MockLoggerManagerClient } from '../../__mocks__/loggermanager';

async function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, ms);
  });
}

describe('Webview view tests ', () => {
  let extHostWebview: IExtHostWebview;
  let extHostWebviewView: ExtHostWebviewViews;
  let mainThreadWebview: MainThreadWebview;
  const injector = createBrowserInjector([]);

  const webviews = new Map<string, IWebview>();
  const viewVisible = new Map<string, boolean>();

  injector.addProviders({
    token: ILoggerManagerClient,
    useClass: MockLoggerManagerClient,
  }, {
    token: IWebviewService,
    useValue: mockService<IWebviewService>({
      createWebview: () => {
        const id = makeRandomHexString(5);
        const webview: IWebview = ({
          id,
          appendTo: jest.fn(),
          onMessage: new Emitter().event,
          postMessage: jest.fn(),
          dispose: jest.fn(),
          setContent: jest.fn(),
          onDispose: new Emitter().event,
        } as Partial<IWebview>) as any;
        webviews.set(id, webview);
        return webview;
      },
      getWebview: (id) => {
        return webviews.get(id);
      },
    }),
  }, {
    token: WorkbenchEditorService,
    useValue: mockService({
      onActiveResourceChange: new Emitter().event,
    }),
  }, {
    token: IIconService,
    useValue: mockService({}),
  }, {
    token: StaticResourceService,
    useValue: mockService({}),
  }, {
    token: IOpenerService,
    useValue: mockService({}),
  }, {
    token: CommandRegistry,
    useValue: mockService({}),
  }, {
    token: IMainLayoutService,
    useValue: mockService<IMainLayoutService>({
      isViewVisible: (viewId) => {
        return !!viewVisible.get(viewId);
      },
      getTabbarHandler: () => {
        return {
          onActivate: new Emitter().event,
          onInActivate: new Emitter().event,
        } as any;
      },
    }),
  });

  const emitterA = new Emitter<any>();
  const emitterB = new Emitter<any>();

  const mockClientA = {
    send: (msg) => emitterB.fire(msg),
    onMessage: emitterA.event,
  };
  const mockClientB = {
    send: (msg) => emitterA.fire(msg),
    onMessage: emitterB.event,
  };

  const rpcProtocolExt = new RPCProtocol(mockClientA);

  const rpcProtocolMain = new RPCProtocol(mockClientB);

  beforeAll((done) => {
    extHostWebview = new ExtHostWebviewService(rpcProtocolExt);
    extHostWebviewView = new ExtHostWebviewViews(rpcProtocolExt, extHostWebview as ExtHostWebviewService);

    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostWebview, extHostWebview);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostWebviewView, extHostWebviewView);
    mainThreadWebview = rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWebview, injector.get(MainThreadWebview, [rpcProtocolMain]));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWebviewView, injector.get(MainThreadWebviewView, [rpcProtocolMain, mainThreadWebview]));

    done();
  });

  it('display a webview view', async (done) => {
    const viewType = 'webviewViewTestViewType';

    const testProvider: WebviewViewProvider = {
      resolveWebviewView: jest.fn(async (webviewView: WebviewView) => {
        webviewView.webview.html = 'testHtmlContent';
      }),
    };

    const ext: IExtensionDescription = {
      identifier: new ExtensionIdentifier('testPublisher.testExtension'),
    } as any;

    extHostWebviewView.registerWebviewViewProvider(ext, viewType, testProvider);

    const eventBus: IEventBus = injector.get(IEventBus);

    const container = document.createElement('div');

    viewVisible.set(viewType, true);

    eventBus.fire(new WebviewViewShouldShowEvent({
      title: 'testTitle',
      viewType,
      container,
      cancellationToken: new CancellationTokenSource().token,
      disposer: new Disposable(),
    }));

    await delay(100);
    expect(webviews.size).toBe(1);

    const webview = webviews.get(Array.from(webviews.keys())[0])!;
    expect(webview.appendTo).toBeCalledWith(container);
    expect(webview.setContent).toBeCalledWith('testHtmlContent');

    done();
  });

  afterAll(() => {
    injector.disposeAll();
    Array.from(webviews.entries()).forEach(([i, w]) => w.dispose());
  });

});
