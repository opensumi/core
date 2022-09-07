import { CommandRegistry, IContextKeyService } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
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

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('new StatusBar elements', () => {
    expect(statusBarService.leftEntries.length).toBe(1);
  });

  it('modify StatusBar elements', () => {
    statusBarService.setElement(EN_CODING_ENTRY_ID, {
      text: 'GBK',
      alignment: StatusBarAlignment.RIGHT,
    });
    expect(statusBarService.rightEntries[0].text).toBe('GBK');
  });

  it('modify not exists StatusBar elements will throw error', () => {
    expect(() => {
      statusBarService.setElement('encoding1', {
        text: 'GBK',
        alignment: StatusBarAlignment.LEFT,
      });
    }).toThrowError('not found id is encoding1 element');
  });

  it('execute onclick function', () => {
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

  it('delete elements', () => {
    statusBarService.removeElement(EN_CODING_ENTRY_ID);

    expect(statusBarService.leftEntries.length).toBe(0);
  });

  it('compare elements', () => {
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

  it('set background color', () => {
    statusBarService.setColor('red');
    statusBarService.setBackgroundColor('blue');

    expect(statusBarService.getColor()).toBe('red');
    expect(statusBarService.getBackgroundColor()).toBe('blue');
  });

  it('registry menu while setting name', () => {
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

  it('the menu should only be registered once when setting two StatusBar elements with the same id', () => {
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

  it('the menu should be sorted left and right', () => {
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

  it('setting element tobe hidden', () => {
    expect(statusBarService.leftEntries.length).toBe(1);

    statusBarService.addElement('status.scm', {
      text: 'scm',
      alignment: StatusBarAlignment.LEFT,
      hidden: true,
    });
    // 设置隐藏后 leftEntries 长度应该还是一个
    expect(statusBarService.leftEntries.length).toBe(1);
  });

  it('toggle element visible', () => {
    // 默认显示
    expect(statusBarService.leftEntries[0].hidden).toBeFalsy();
    statusBarService.toggleElement(EN_CODING_ENTRY_ID);
    // 隐藏后 leftEntries 应该长度为 0
    expect(statusBarService.leftEntries.length).toBe(0);
  });

  it('the same StatusBar elements should be triggered at the same time', () => {
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
