import { Emitter, Disposable } from '@ali/ide-core-common';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MainThreadTreeView } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.treeview';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IMenuRegistry } from '@ali/ide-core-browser/src/menu/next';
import { IContextKeyService, PreferenceService } from '@ali/ide-core-browser/src';
import { IIconService } from '@ali/ide-theme';

const mockExtThreadTreeViewProxy = {
  $postMessage: jest.fn(),
  $dispatchClosed: jest.fn(),
  $getChildren: jest.fn(() => {}),
  $setVisible: jest.fn(),
};

let mainThreadTreeView: MainThreadTreeView;

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

  const injector = createBrowserInjector([], new MockInjector([
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
  ]));

  beforeAll(() => {
    mainThreadTreeView = injector.get(MainThreadTreeView, [mockProxy as any]);
  });

  it('should able to $registerTreeDataProvider', async () => {
    const treeViewId = 'testView';
    mainThreadTreeView.$registerTreeDataProvider(treeViewId, {});
    expect(mockMainLayoutService.replaceViewComponent).toBeCalledTimes(1);
    expect(mockMenuRegistry.registerMenuItem).toBeCalledTimes(1);
  });

  it('should able to $refresh', async (done) => {
    const treeViewId = 'testView';
    await mainThreadTreeView.$refresh(treeViewId);
    done();
  });

  it('should able to $reveal', async (done) => {
    const treeViewId = 'testView';
    const treeItemId = 'testItem';
    await mainThreadTreeView.$reveal(treeViewId, treeItemId, {});
    expect(mockMainLayoutService.revealView).toBeCalledTimes(1);
    done();
  });

  it('status listener should be work', () => {
    mockActiveEmitter.fire();
    expect(mockExtThreadTreeViewProxy.$setVisible).toBeCalledTimes(1);
    mockInActiveEmitter.fire();
    expect(mockExtThreadTreeViewProxy.$setVisible).toBeCalledTimes(2);
  });

  it('should able to $unregisterTreeDataProvider', () => {
    const treeViewId = 'testView';
    mainThreadTreeView.$unregisterTreeDataProvider(treeViewId);
    expect(mockTabbarHandler.disposeView).toBeCalledTimes(1);
  });
});
