import { WindowService } from '@opensumi/ide-core-browser/lib/window/window.service';
import { IElectronMainLifeCycleService, IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { URI, IWindowService } from '../../src';
import { IExternalUriService } from '../../src/services';

describe('test windowService on Electron env', () => {
  let injector: MockInjector;
  let windowService: IWindowService;
  const mockElectronMainUIService = {
    openExternal: jest.fn(),
  };

  const mockElectronMainLifeCycleService = {
    openWorkspace: jest.fn(),
    maximizeWindow: jest.fn(),
    unmaximizeWindow: jest.fn(),
    fullscreenWindow: jest.fn(),
    minimizeWindow: jest.fn(),
  };

  // 如果 window 已经关闭的情况下调用 close 会导致报错退出
  // https://github.com/jsdom/jsdom/issues/2121
  jest.spyOn(window, 'close').mockImplementation(() => {
    // mocked window.close()
  });

  beforeAll(() => {
    (global as any).isElectronRenderer = true;
    injector = createBrowserInjector([]);
    injector.overrideProviders(
      {
        token: IExternalUriService,
        useValue: {},
      },
      {
        token: IElectronMainUIService,
        useValue: mockElectronMainUIService,
      },
      {
        token: IElectronMainLifeCycleService,
        useValue: mockElectronMainLifeCycleService,
      },
      {
        token: IWindowService,
        useClass: WindowService,
      },
    );

    windowService = injector.get(IWindowService);
  });

  afterAll(() => {
    (global as any).isElectronRenderer = false;
    injector.disposeAll();
  });

  it('openNewWindow method should be work', () => {
    windowService.openNewWindow('http://opensumi.com');
    expect(mockElectronMainUIService.openExternal).toBeCalled();
  });

  it('openWorkspace method should be work', () => {
    windowService.openWorkspace(URI.file('home/test'));
    expect(mockElectronMainLifeCycleService.openWorkspace).toBeCalled();
  });

  it('close method should be work', () => {
    windowService.close();
  });

  it('maximize method should be work', () => {
    windowService.maximize();
    expect(mockElectronMainLifeCycleService.maximizeWindow).toBeCalled();
  });

  it('unmaximize method should be work', () => {
    windowService.unmaximize();
    expect(mockElectronMainLifeCycleService.unmaximizeWindow).toBeCalled();
  });

  it('fullscreen method should be work', () => {
    windowService.fullscreen();
    expect(mockElectronMainLifeCycleService.fullscreenWindow).toBeCalled();
  });

  it('minimize method should be work', () => {
    windowService.minimize();
    expect(mockElectronMainLifeCycleService.minimizeWindow).toBeCalled();
  });
});

describe('test windowService on web', () => {
  let injector: MockInjector;
  let windowService: IWindowService;
  const mockExternalUriService = {
    resolveExternalUri: jest.fn((uri) => uri.toString()),
  };

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.overrideProviders(
      {
        token: IExternalUriService,
        useValue: mockExternalUriService,
      },
      {
        token: IWindowService,
        useClass: WindowService,
      },
    );

    windowService = injector.get(IWindowService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('openNewWindow method should be work', () => {
    windowService.openNewWindow('http://opensumi.com', { external: true });
    expect(mockExternalUriService.resolveExternalUri).toBeCalled();
  });

  it('openWorkspace method should be work', () => {
    expect(windowService.openWorkspace).toThrowError();
  });

  it('close method should be work', () => {
    expect(windowService.close).toThrowError();
  });

  it('maximize method should be work', () => {
    expect(windowService.maximize).toThrowError();
  });

  it('unmaximize method should be work', () => {
    expect(windowService.unmaximize).toThrowError();
  });

  it('fullscreen method should be work', () => {
    expect(windowService.fullscreen).toThrowError();
  });

  it('minimize method should be work', () => {
    expect(windowService.minimize).toThrowError();
  });
});
