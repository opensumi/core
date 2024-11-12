import { VALIDATE_TYPE } from '@opensumi/ide-components';
import { HideReason, IContextKeyService, URI } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { StaticResourceServiceImpl } from '@opensumi/ide-core-browser/lib/static-resource/static.service';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MonacoContextKeyService } from '@opensumi/ide-monaco/lib/browser/monaco.context-key.service';
import { IconService } from '@opensumi/ide-theme/lib/browser/icon.service';
import { IIconService, IThemeService } from '@opensumi/ide-theme/lib/common';

import { QuickOpenModule } from '../../src/browser';
import { QuickOpenItemService } from '../../src/browser/quick-open-item.service';
import { IQuickOpenWidget } from '../../src/browser/quick-open.type';
import { QuickOpenItem, QuickOpenModel, QuickOpenService } from '../../src/common';

describe('quick-open service test', () => {
  let injector: MockInjector;
  let quickOpenService: QuickOpenService;
  let container: HTMLDivElement;
  let widget: IQuickOpenWidget;
  let model: QuickOpenModel;

  beforeAll(() => {
    container = document.createElement('div');
    container.id = 'ide-overlay';
    document.body.appendChild(container);
  });

  afterAll(() => {
    document.body.removeChild(container);
  });

  beforeEach(() => {
    injector = createBrowserInjector([QuickOpenModule]);
    injector.overrideProviders(
      {
        token: MonacoContextKeyService,
        useValue: mockService({}),
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: QuickOpenItemService,
        useClass: QuickOpenItemService,
      },
      {
        token: IIconService,
        useClass: IconService,
      },
      {
        token: IThemeService,
        useValue: {
          getCurrentThemeSync: () => ({
            type: 'dark',
          }),
        },
      },
      {
        token: StaticResourceService,
        useClass: StaticResourceServiceImpl,
      },
    );
    model = {
      onType: jest.fn(),
    };
    quickOpenService = injector.get(QuickOpenService);
    // 以下 initWidgetView 与 widget 为私有变量
    // @ts-ignore
    jest.spyOn<any, any>(quickOpenService, 'initWidgetView').mockImplementation();
    // @ts-ignore
    widget = quickOpenService.widget;
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('show quick-open', () => {
    const $widgetShow = jest.spyOn(widget, 'show');
    quickOpenService.open(model);
    expect(widget.isShow).toBeTruthy();
    expect($widgetShow).toHaveBeenCalledTimes(1);
    expect($widgetShow).toHaveBeenCalledWith('', {
      inputEnable: true,
      password: false,
      placeholder: '',
      valueSelection: [-1, -1],
    });
  });

  it('show quick-open with options', () => {
    const $widgetShow = jest.spyOn(widget, 'show');
    quickOpenService.open(model, {
      prefix: '>',
      password: true,
      placeholder: 'This is placeholder',
      enabled: false,
      valueSelection: [2, 2],
    });
    expect($widgetShow).toHaveBeenCalledTimes(1);
    expect($widgetShow).toHaveBeenCalledWith('>', {
      inputEnable: false,
      password: true,
      placeholder: 'This is placeholder',
      valueSelection: [2, 2],
    });
  });

  it('when emit onType show quick-open', () => {
    quickOpenService.open(model, {
      prefix: '>',
    });
    expect(model.onType).toHaveBeenCalledWith('>', expect.anything());
  });

  it('hide quick-open with element select', () => {
    const $widgetHide = jest.spyOn(widget, 'hide');
    const $onClose = jest.fn();
    quickOpenService.open(model, {
      onClose: $onClose,
    });
    quickOpenService.hide(HideReason.ELEMENT_SELECTED);
    expect($widgetHide).toHaveBeenCalledTimes(1);
    expect(widget.isShow.get()).toBeFalsy();
    expect($onClose).toHaveBeenCalledTimes(1);
    // false 为非取消类型的关闭
    expect($onClose).toHaveBeenCalledWith(false);
  });

  it('hide quick-open with element select', () => {
    const $widgetHide = jest.spyOn(widget, 'hide');
    const $onClose = jest.fn();
    quickOpenService.open(model, {
      onClose: $onClose,
    });
    quickOpenService.hide(HideReason.FOCUS_LOST);
    expect($widgetHide).toHaveBeenCalledTimes(1);
    expect(widget.isShow.get()).toBeFalsy();
    // true 为取消类型的关闭
    expect($onClose).toHaveBeenCalledWith(true);
  });

  it('refresh quick-open', () => {
    quickOpenService.open(model);
    quickOpenService.refresh();
    // refresh 时 onType 会被重新调用
    expect(model.onType).toHaveBeenCalledWith(widget.inputValue.get(), expect.anything());
  });

  it('show quick-open decoration', () => {
    quickOpenService.open(model);
    quickOpenService.showDecoration(VALIDATE_TYPE.ERROR);
    expect(widget.validateType.get()).toBe(VALIDATE_TYPE.ERROR);
    quickOpenService.hideDecoration();
    expect(widget.validateType.get()).toBeUndefined();
  });

  it('show quick-open item buttons', () => {
    const quickOpenItemService = injector.get(QuickOpenItemService);
    quickOpenItemService.getButtons([
      {
        iconPath: {
          dark: URI.file('resources/dark/add.svg'),
          light: URI.file('resources/dark/add.svg'),
        },
        tooltip: 'demo button',
      },
    ]);
  });

  // onType 为 quickOpen 最主要的回调方法，在这里着重测试
  describe('onType', () => {
    const items = [
      new QuickOpenItem({
        label: 'AAAAA',
      }),
      new QuickOpenItem({
        label: 'AAAAA2',
      }),
      new QuickOpenItem({
        label: 'BBBB',
        description: 'This is description of BBBB',
      }),
      new QuickOpenItem({
        label: 'hello world',
        detail: 'This is Hello World',
      }),
    ];
    beforeEach(() => {
      model = {
        onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void) {
          acceptor(items);
        },
      };
    });

    it('do not filter when no fuzz match', () => {
      quickOpenService.open(model, {
        prefix: 'AAA',
      });
      expect(widget.items.get()).toStrictEqual(items);
    });

    it('match label', () => {
      quickOpenService.open(model, {
        prefix: 'AAA',
        fuzzyMatchLabel: true,
      });
      expect(widget.items.get()).toHaveLength(2);
      expect(widget.items.get()[0].getLabel()).toBe('AAAAA');
      expect(widget.items.get()[1].getLabel()).toBe('AAAAA2');
    });

    it('match label width enableSeparateSubstringMatching', () => {
      quickOpenService.open(model, {
        prefix: 'hld',
        fuzzyMatchLabel: {
          enableSeparateSubstringMatching: true,
        },
      });
      expect(widget.items.get()).toHaveLength(1);
      const [labelHighlights] = widget.items.get()[0].getHighlights();
      expect(labelHighlights).toStrictEqual([
        { end: 1, start: 0 },
        { end: 3, start: 2 },
        { end: 11, start: 10 },
      ]);
    });

    it('match label width fallback', () => {
      const MyQuickOpenItem = class extends QuickOpenItem {
        getLabelHighlights() {
          return [{ start: 1, end: 2 }];
        }
      };
      model = {
        onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void) {
          acceptor([new MyQuickOpenItem({ label: 'CCC' })]);
        },
      };
      quickOpenService.open(model, {
        prefix: 'AAA',
      });
      expect(widget.items.get()).toHaveLength(1);
    });

    it('match description', () => {
      quickOpenService.open(model, {
        prefix: 'BBB',
        fuzzyMatchDescription: true,
      });
      expect(widget.items.get()).toHaveLength(4);
      const [, descriptionHighlights] = widget.items.get()[2].getHighlights();
      expect(descriptionHighlights).toStrictEqual([{ start: 23, end: 26 }]);
    });

    it('match detail', () => {
      quickOpenService.open(model, {
        prefix: 'Hello',
        fuzzyMatchDetail: true,
      });
      expect(widget.items.get()).toHaveLength(4);
      const [, , detailHighlights] = widget.items.get()[3].getHighlights();
      expect(detailHighlights).toStrictEqual([{ start: 8, end: 13 }]);
    });

    it('compare label with fuzzySort', () => {
      model = {
        onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void) {
          acceptor([
            new QuickOpenItem({ label: 'Show Running Extensions', description: 'Show Running Extensions' }),
            new QuickOpenItem({ label: 'Hon', description: 'Hon' }),
          ]);
        },
      };
      quickOpenService.open(model, {
        prefix: 'hon',
        fuzzySort: true,
        fuzzyMatchLabel: {
          enableSeparateSubstringMatching: true,
        },
      });
      expect(widget.items.get()).toHaveLength(2);
      expect(widget.items.get()[0].getLabel()).toBe('Hon');
    });
  });

  // callback 为 widget 组件内主动调用
  describe('callbacks', () => {
    it('onSelect to be called when onSelect be called', () => {
      const $onSelect = jest.fn();
      const item = new QuickOpenItem({
        label: 'hello',
      });
      quickOpenService.open(model, {
        onSelect: $onSelect,
      });
      // trigger onSelect
      widget.callbacks.onSelect(item, 1);
      expect($onSelect).toHaveBeenCalledWith(item, 1);
    });

    it('onConfirm to be call', () => {
      const $onConfirm = jest.fn();
      const item = new QuickOpenItem({
        label: 'hello',
      });
      quickOpenService.open(model, {
        onConfirm: $onConfirm,
      });
      // trigger onSelect
      widget.callbacks.onConfirm([item]);
      expect($onConfirm).toHaveBeenCalledWith([item]);
    });

    it('the inQuickOpen contextkey to be false when onHide be called', () => {
      const contextKeyService = injector.get<MockContextKeyService>(IContextKeyService);
      quickOpenService.open(model);
      expect(contextKeyService.store.get('inQuickOpen')).toBeTruthy();
      // onHide 被触发
      widget.callbacks.onHide(HideReason.FOCUS_LOST);
      // inQuickOpen contextKey 会被设置为 false
      expect(contextKeyService.store.get('inQuickOpen')).toBeFalsy();
    });

    it('onClose to be called when onOK be called', () => {
      const $onClose = jest.fn();
      quickOpenService.open(model, {
        onClose: $onClose,
        ignoreFocusOut: true,
      });
      // trigger onOk
      widget.callbacks.onOk();
      expect($onClose).toHaveBeenCalledWith(false);
    });

    it('onClose to be called when onCancel be called', () => {
      const $onClose = jest.fn();
      quickOpenService.open(model, {
        onClose: $onClose,
        ignoreFocusOut: true,
      });
      // trigger onOk
      widget.callbacks.onCancel();
      expect($onClose).toHaveBeenCalledWith(true);
    });

    it('onClose to be called when ignoreFocusOut is true', () => {
      const $onClose = jest.fn();
      quickOpenService.open(model, {
        onClose: $onClose,
        ignoreFocusOut: true,
      });
      // trigger onFocusLost
      const ignoreFocusOut = widget.callbacks.onFocusLost();
      expect(ignoreFocusOut).toBeTruthy();
      expect($onClose).toHaveBeenCalledTimes(0);
    });

    it('onClose to be called when ignoreFocusOut is false', () => {
      const $onClose = jest.fn();
      quickOpenService.open(model, {
        onClose: $onClose,
        ignoreFocusOut: false,
      });
      // trigger onFocusLost
      const ignoreFocusOut = widget.callbacks.onFocusLost();
      // true 为取消类型的关闭
      expect(ignoreFocusOut).toBeFalsy();
      expect($onClose).toHaveBeenCalledWith(true);
    });
  });

  // 直接调用事件
  describe('event', () => {
    it('fire item button event', () => {
      const quickOpenItemService = injector.get(QuickOpenItemService);
      quickOpenItemService.onDidTriggerItemButton((event) => {
        expect(event.item).toBe(0);
        expect(event.button.tooltip).toBe('tooltip');
      });
      quickOpenItemService.fireDidTriggerItemButton(0, {
        iconPath: {
          dark: URI.file('resources/dark/add.svg'),
          light: URI.file('resources/dark/add.svg'),
        },
        tooltip: 'tooltip',
      });
    });
  });
});
