import { CommandRegistry, IContextKeyService, ILoggerManagerClient } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import { LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IStatusBarService, StatusBarAlignment, StatusBarEntry } from '@opensumi/ide-core-browser/lib/services';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { StatusBarModule } from '@opensumi/ide-status-bar/lib/browser';

describe('template test', () => {
  const EN_CODING_ENTRY_ID = 'encoding';
  // 命令 id
  const SELECT_ENCODING = 'select.encoding';
  const enCodingEntry: StatusBarEntry = {
    text: 'UTF-8',
    alignment: StatusBarAlignment.LEFT,
    command: SELECT_ENCODING,
    priority: 10,
  };
  let injector: MockInjector;
  let statusBarService: IStatusBarService;

  beforeEach(async () => {
    injector = createBrowserInjector([StatusBarModule]);
    injector.overrideProviders(
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: LayoutState,
        useValue: mockService({
          getState: () => ({}),
        }),
      },
    );
    statusBarService = injector.get<IStatusBarService>(IStatusBarService);
    statusBarService.addElement(EN_CODING_ENTRY_ID, enCodingEntry);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('新增 statusBar Item', () => {
    expect(statusBarService.leftEntries.length).toBe(1);
  });

  it('修改 statusBar Item', () => {
    statusBarService.setElement(EN_CODING_ENTRY_ID, {
      text: 'GBK',
      alignment: StatusBarAlignment.RIGHT,
    });
    expect(statusBarService.rightEntries[0].text).toBe('GBK');
  });

  it('修改 statusBar Item 未找到时抛异常', () => {
    expect(() => {
      statusBarService.setElement('encoding1', {
        text: 'GBK',
        alignment: StatusBarAlignment.LEFT,
      });
    }).toThrowError('not found id is encoding1 element');
  });

  it('执行 onclick 方法', () => {
    const commandRegistry = injector.get<CommandRegistry>(CommandRegistry);
    const $execute = jest.fn();
    commandRegistry.registerCommand(
      {
        id: SELECT_ENCODING,
      },
      {
        execute: $execute,
      },
    );

    enCodingEntry.onClick!({});

    // 执行到了命令
    expect($execute).toBeCalled();
  });

  it('删除一个 item', () => {
    statusBarService.removeElement(EN_CODING_ENTRY_ID);

    expect(statusBarService.leftEntries.length).toBe(0);
  });

  it('权重对比', () => {
    statusBarService.addElement('git', {
      text: 'UTF-8',
      alignment: StatusBarAlignment.LEFT,
      command: SELECT_ENCODING,
      priority: 20,
    });

    // 加上 beforeEach 的应该有两个
    expect(statusBarService.leftEntries.length).toBe(2);
    // 权重高的在前面
    expect(statusBarService.leftEntries[0].id).toBe('git');

    statusBarService.removeElement('git');
  });

  it('设置背景色颜色', () => {
    statusBarService.setColor('red');
    statusBarService.setBackgroundColor('blue');

    expect(statusBarService.leftEntries[0].color).toBe('red');
    expect(statusBarService.getBackgroundColor()).toBe('blue');
  });

  it('设置 name 时注册菜单', () => {
    const menuRegistry = injector.get(IMenuRegistry);
    const $registerMenu = jest.spyOn(menuRegistry, 'registerMenuItem');
    statusBarService.addElement('status.scm', {
      name: 'Source Control',
      text: 'scm',
      alignment: StatusBarAlignment.RIGHT,
    });
    expect(statusBarService.rightEntries[0].name).toBe('Source Control');
    expect($registerMenu).toBeCalledTimes(1);
    expect($registerMenu).toBeCalledWith('statusbar/context', {
      command: { id: 'statusbar.toggleElement', label: 'Source Control' },
      extraTailArgs: ['status.scm'],
      order: 9007199254740991,
      toggledWhen: 'status.scm:toggle',
    });
  });

  it('设置两个 id 一样的状态栏元素时应该只注册一次菜单', () => {
    const menuRegistry = injector.get(IMenuRegistry);
    const $registerMenu = jest.spyOn(menuRegistry, 'registerMenuItem');
    statusBarService.addElement('status.scm', {
      id: 'status.scm',
      name: 'Source Control',
      text: 'scm',
      alignment: StatusBarAlignment.RIGHT,
    });
    statusBarService.addElement('status.scm-1', {
      id: 'status.scm',
      name: 'Source Control',
      text: 'scm-1',
      alignment: StatusBarAlignment.RIGHT,
    });
    expect(statusBarService.rightEntries.length).toBe(2);
    expect(statusBarService.rightEntries[0].name).toBe('Source Control');
    // 菜单只应该注册一次
    expect($registerMenu).toBeCalledTimes(1);
  });

  it('注册状态栏后菜单应该按照左右排序', () => {
    const menuRegistry = injector.get<IMenuRegistry>(IMenuRegistry);
    statusBarService.addElement('status.left', {
      name: 'Source Control',
      text: 'scm',
      alignment: StatusBarAlignment.LEFT,
      priority: 999,
    });
    statusBarService.addElement('status.right1', {
      name: 'Source Control',
      text: 'scm',
      alignment: StatusBarAlignment.RIGHT,
      priority: 99,
    });
    statusBarService.addElement('status.right2', {
      name: 'Source Control',
      text: 'scm-1',
      alignment: StatusBarAlignment.RIGHT,
      priority: 9,
    });
    const menuItems = menuRegistry.getMenuItems(MenuId.StatusBarContext);
    const statusBarOrder1 = menuItems.find((item: any) => item.toggledWhen === 'status.left:toggle')?.order!;
    const statusBarOrder2 = menuItems.find((item: any) => item.toggledWhen === 'status.right1:toggle')?.order!;
    const statusBarOrder3 = menuItems.find((item: any) => item.toggledWhen === 'status.right2:toggle')?.order!;
    // 注册到 menu 的 order 从左到右增大
    expect(statusBarOrder1).toBeLessThan(statusBarOrder2);
    expect(statusBarOrder2).toBeLessThan(statusBarOrder3);
  });

  it('设置隐藏', () => {
    expect(statusBarService.leftEntries.length).toBe(1);

    statusBarService.addElement('status.scm', {
      text: 'scm',
      alignment: StatusBarAlignment.LEFT,
      hidden: true,
    });
    // 设置隐藏后 leftEntries 长度应该还是一个
    expect(statusBarService.leftEntries.length).toBe(1);
  });

  it('触发显隐', () => {
    // 默认显示
    expect(statusBarService.leftEntries[0].hidden).toBeFalsy();
    statusBarService.toggleElement(EN_CODING_ENTRY_ID);
    // 隐藏后 leftEntries 应该长度为 0
    expect(statusBarService.leftEntries.length).toBe(0);
  });

  it('statusbar id 相同则都触发显隐', () => {
    // 注册两个 id 相同的 scm 状态栏元素
    statusBarService.addElement('status.scm', {
      id: 'status.scm',
      name: 'Source Control',
      text: 'scm',
      alignment: StatusBarAlignment.RIGHT,
    });
    statusBarService.addElement('status.scm-1', {
      id: 'status.scm',
      name: 'Source Control',
      text: 'scm-1',
      alignment: StatusBarAlignment.RIGHT,
    });
    // 注册一个其他状态栏元素
    statusBarService.addElement('status.other', {
      id: 'status.other',
      name: 'Other',
      text: 'other',
      alignment: StatusBarAlignment.RIGHT,
    });
    expect(statusBarService.rightEntries.length).toBe(3);
    // 隐藏 scm 相关状态栏
    statusBarService.toggleElement('status.scm');
    // 隐藏后 leftEntries 应该长度为 1
    expect(statusBarService.rightEntries.length).toBe(1);
  });
});
