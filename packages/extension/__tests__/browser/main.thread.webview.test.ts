import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { IOpenerService } from '@opensumi/ide-core-browser/lib/opener';
import {
  Emitter,
  makeRandomHexString,
  IEventBus,
  Disposable,
  CancellationTokenSource,
  CommandRegistry,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';
import { WebviewViewShouldShowEvent } from '@opensumi/ide-extension/lib/browser/components/extension-webview-view';
import {
  MainThreadWebview,
  MainThreadWebviewView,
} from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.api.webview';
import { IExtensionDescription, ExtensionIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { WebviewViewProvider, WebviewView } from '@opensumi/ide-extension/lib/common/vscode/webview';
import {
  ExtHostWebviewViews,
  ExtHostWebviewService,
} from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.api.webview';
import { ILoggerManagerClient } from '@opensumi/ide-logs';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { StaticResourceService } from '@opensumi/ide-static-resource';
import { IIconService } from '@opensumi/ide-theme';
import { IWebviewService, IWebview } from '@opensumi/ide-webview';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { MockLoggerManagerClient } from '../../__mocks__/loggermanager';
import { IExtHostWebview, ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '../../lib/common/vscode';

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

  injector.addProviders(
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManagerClient,
    },
    {
      token: IWebviewService,
      useValue: mockService<IWebviewService>({
        createWebview: () => {
          const id = makeRandomHexString(5);
          const webview: IWebview = {
            id,
            appendTo: jest.fn(),
            onMessage: new Emitter().event,
            postMessage: jest.fn(),
            dispose: jest.fn(),
            setContent: jest.fn(),
            onDispose: new Emitter().event,
          } as Partial<IWebview> as any;
          webviews.set(id, webview);
          return webview;
        },
        getWebview: (id) => webviews.get(id),
      }),
    },
    {
      token: WorkbenchEditorService,
      useValue: mockService({
        onActiveResourceChange: new Emitter().event,
      }),
    },
    {
      token: IIconService,
      useValue: mockService({}),
    },
    {
      token: StaticResourceService,
      useValue: mockService({}),
    },
    {
      token: IOpenerService,
      useValue: mockService({}),
    },
    {
      token: CommandRegistry,
      useValue: mockService({}),
    },
    {
      token: IMainLayoutService,
      useValue: mockService<IMainLayoutService>({
        isViewVisible: (viewId) => !!viewVisible.get(viewId),
        getTabbarHandler: () =>
          ({
            onActivate: new Emitter().event,
            onInActivate: new Emitter().event,
          } as any),
      }),
    },
  );

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
    mainThreadWebview = rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadWebview,
      injector.get(MainThreadWebview, [rpcProtocolMain]),
    );
    rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadWebviewView,
      injector.get(MainThreadWebviewView, [rpcProtocolMain, mainThreadWebview]),
    );

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

    eventBus.fire(
      new WebviewViewShouldShowEvent({
        title: 'testTitle',
        viewType,
        container,
        cancellationToken: new CancellationTokenSource().token,
        disposer: new Disposable(),
      }),
    );

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
