import { IThemeService, ITheme } from '@opensumi/ide-theme';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { Disposable } from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-browser';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import { EditorComponentRegistry, EditorPreferences } from '@opensumi/ide-editor/lib/browser';

import { IWebviewService } from '../../src/browser';
import { WebviewServiceImpl } from '../../src/browser/webview.service';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';

const injector = createBrowserInjector([]);

injector.addProviders(
  {
    token: IWebviewService,
    useClass: WebviewServiceImpl,
  },
  {
    token: IThemeService,
    useValue: {
      getCurrentThemeSync: () =>
        ({
          type: 'dark',
          themeData: { id: 'vs-dark' } as any,
          defines: () => false,
          getColor: () => undefined,
        } as ITheme),
    },
  },
  {
    token: StaticResourceService,
    useValue: {
      registerStaticResourceProvider(provider) {
        return new Disposable();
      },
      resolveStaticResource(uri) {
        return uri;
      },
    },
  },
  {
    token: EditorComponentRegistry,
    useValue: {},
  },
  {
    token: WorkbenchEditorService,
    useValue: {},
  },
  {
    token: EditorPreferences,
    useValue: {},
  },
);

const appConfig = injector.get(AppConfig) as AppConfig;
injector.overrideProviders({
  token: AppConfig,
  useValue: {
    ...appConfig,
    isElectronRenderer: true,
  },
});

mockIframeAndElectronWebview();

describe('web platform webview service test suite', () => {
  it('should be able to create iframe webview', async (done) => {
    const service: IWebviewService = injector.get(IWebviewService);
    const webview = service.createWebview();
    expect(webview).toBeDefined();
    webview.appendTo(document.createElement('div'));
    const html = '<HTML> TEST <HTML>';
    await webview.setContent(html);
    expect(webview.getContent()).toBe(html);
    done();
  });

  it('should be able to create plain iframe webview', async (done) => {
    const service: IWebviewService = injector.get(IWebviewService);
    const webview = service.createPlainWebview();
    expect(webview).toBeDefined();
    webview.appendTo(document.createElement('div'));
    (webview as any)._ready.resolve(); // mock ready;
    webview.loadURL('http://example.test.com').then(() => {
      expect(webview.url).toBe('http://example.test.com');
      done();
    });
    setTimeout(() => {
      const event = new window.Event('load');
      ((webview as any)._iframe as HTMLIFrameElement).dispatchEvent(event);
    }, 100);
  });

  it('should be able to create electron webview webviewComponent', async (done) => {
    const registerFn = jest.fn(() => new Disposable());
    const registerFn2 = jest.fn(() => new Disposable());
    injector.mock(EditorComponentRegistry, 'registerEditorComponent', registerFn);
    injector.mock(EditorComponentRegistry, 'registerEditorComponentResolver', registerFn2);
    const service: IWebviewService = injector.get(IWebviewService);
    const webview = service.createEditorPlainWebviewComponent();
    expect(webview).toBeDefined();
    expect(registerFn).toBeCalled();
    expect(registerFn2).toBeCalled();
    done();
  });
});

describe('electron platform webview service test suite', () => {
  beforeAll(() => {
    (global as any).isElectronRenderer = true;
  });

  it('should be able to create electron webview', async (done) => {
    const service: IWebviewService = injector.get(IWebviewService);
    const webview = service.createWebview();
    expect(webview).toBeDefined();
    webview.appendTo(document.createElement('div'));
    const html = '<HTML> TEST <HTML>';
    await webview.setContent(html);
    expect(webview.getContent()).toBe(html);
    done();
  });

  it('should be able to create electron plain webview', async (done) => {
    const service: IWebviewService = injector.get(IWebviewService);
    const webview = service.createPlainWebview();
    expect(webview).toBeDefined();
    webview.appendTo(document.createElement('div'));
    await webview.loadURL('http://example.test.com');
    expect(webview.url).toBe('http://example.test.com');
    done();
  });

  it('should be able to create electron webview webviewComponent', async (done) => {
    const registerFn = jest.fn(() => new Disposable());
    const registerFn2 = jest.fn(() => new Disposable());
    injector.mock(EditorComponentRegistry, 'registerEditorComponent', registerFn);
    injector.mock(EditorComponentRegistry, 'registerEditorComponentResolver', registerFn2);
    const service: IWebviewService = injector.get(IWebviewService);
    const webview = service.createEditorPlainWebviewComponent();
    expect(webview).toBeDefined();
    expect(registerFn).toBeCalled();
    expect(registerFn2).toBeCalled();
    done();
  });

  afterAll(() => {
    beforeAll(() => {
      delete (global as any).isElectronRenderer;
    });
  });
});

function mockIframeAndElectronWebview() {
  const original = document.createElement;
  document.createElement = function (tagName, ...args) {
    const element: any = original.call(this as any, tagName, ...args);
    if (tagName === 'iframe') {
      element.sandbox = {
        add: () => null,
      };
      Object.defineProperty(element, 'contentWindow', {
        get: () => ({
          document: {
            body: document.createElement('div'),
          },
        }),
      });
    }
    if (tagName === 'webview') {
    }
    return element;
  };
}
