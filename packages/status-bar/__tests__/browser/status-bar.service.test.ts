import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { IStatusBarService, StatusBarAlignment, StatusBarEntry } from '@ali/ide-core-browser/lib/services';
import { StatusBarModule } from '@ali/ide-status-bar/lib/browser';
import { CommandRegistry } from '@ali/ide-core-browser';

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
  const injector = createBrowserInjector([
    StatusBarModule,
  ]);
  const statusBarService = injector.get<IStatusBarService>(IStatusBarService);

  beforeEach(() => {
    statusBarService.addElement(EN_CODING_ENTRY_ID, enCodingEntry);
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
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    commandRegistry.registerCommand({
      id: SELECT_ENCODING,
    }, {
      execute() {
        console.log('executed!');
      },
    });

    enCodingEntry.onClick!({});

    // 执行到了命令
    expect(logSpy.mock.calls[0][0]).toMatch('executed!');
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

});
