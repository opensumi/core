import { Emitter, Disposable } from '@ide-framework/ide-core-common';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MainThreadTreeView } from '@ide-framework/ide-extension/lib/browser/vscode/api/main.thread.treeview';
import { IMainLayoutService } from '@ide-framework/ide-main-layout';
import { IMenuRegistry } from '@ide-framework/ide-core-browser/src/menu/next';
import { IContextKeyService, PreferenceService } from '@ide-framework/ide-core-browser/src';
import { IIconService, IThemeService } from '@ide-framework/ide-theme';
import { IFileServiceClient } from '@ide-framework/ide-file-service';
import { MockFileServiceClient } from '@ide-framework/ide-file-service/lib/common/mocks';

const mockExtThreadTreeViewProxy = {
  $postMessage: jest.fn(),
  $dispatchClosed: jest.fn(),
  $getChildren: jest.fn(() => {}),
  $setVisible: jest.fn(),
};

const mockProxy = {
  getProxy: () => mockExtThreadTreeViewProxy,
};
const mockActiveEmitter = new Emitter<void>();
const mockInActiveEmitter = new Emitter<void>();

const mockTabbarHandler = {
  onActivate: mockActiveEmitter.event,
  onInActivate: mockInActiveEmitter.event,
  disposeView: jest.fn(),
};
const mockMainLayoutService = {
  replaceViewComponent: jest.fn(),
  getTabbarHandler: jest.fn(() => mockTabbarHandler),
  revealView: jest.fn(),
};

const mockMenuRegistry = {
  registerMenuItem: jest.fn(() => Disposable.create(() => {})),
};

describe('MainThreadTreeView API Test Suite', () => {
  let injector: MockInjector;
  let mainThreadTreeView: MainThreadTreeView;
  const testTreeViewId = 'testView';
  beforeEach(() => {
    jest.clearAllMocks();

    injector = createBrowserInjector([], new MockInjector([
      {
        token: IMainLayoutService,
        useValue: mockMainLayoutService,
      },
      {
        token: IMenuRegistry,
        useValue: mockMenuRegistry,
      },
      {
        token: PreferenceService,
        useValue: {},
      },
      {
        token: IContextKeyService,
        useValue: {},
      },
      {
        token: IIconService,
        useValue: {
          fromIcon: () => '',
        },
      },
      {
        token: IThemeService,
        useValue: {},
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
    ]));

    mainThreadTreeView = injector.get(MainThreadTreeView, [mockProxy as any]);
    mainThreadTreeView.$registerTreeDataProvider(testTreeViewId, {});
  });

  afterEach(() => {
    mainThreadTreeView.$unregisterTreeDataProvider(testTreeViewId);
  });

  it('should able to $registerTreeDataProvider', async (done) => {
    expect(mockMainLayoutService.replaceViewComponent).toBeCalledTimes(1);
    expect(mockMenuRegistry.registerMenuItem).toBeCalledTimes(0);

    mainThreadTreeView.$registerTreeDataProvider('testView1', {
      showCollapseAll: true,
    });
    expect(mockMainLayoutService.replaceViewComponent).toBeCalledTimes(2);
    expect(mockMenuRegistry.registerMenuItem).toBeCalledTimes(1);
    mainThreadTreeView.$unregisterTreeDataProvider('testView1');
    done();
  });

  it('should able to $refresh', async (done) => {
    await mainThreadTreeView.$refresh(testTreeViewId);
    done();
  });

  it('should able to $reveal', async (done) => {
    await mainThreadTreeView.$reveal(testTreeViewId, 'treeItemId', {});
    expect(mockMainLayoutService.revealView).toBeCalledTimes(1);
    done();
  });

  it('status listener should be work', (done) => {
    mockActiveEmitter.fire();
    expect(mockExtThreadTreeViewProxy.$setVisible).toBeCalledTimes(1);
    mockInActiveEmitter.fire();
    expect(mockExtThreadTreeViewProxy.$setVisible).toBeCalledTimes(2);
    done();
  });

  it('should able to $unregisterTreeDataProvider', (done) => {
    mainThreadTreeView.$unregisterTreeDataProvider(testTreeViewId);
    expect(mockTabbarHandler.disposeView).toBeCalledTimes(1);
    done();
  });
});
