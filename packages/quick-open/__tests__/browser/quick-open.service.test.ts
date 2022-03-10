import { VALIDATE_TYPE } from '@opensumi/ide-components';
import { HideReason, IContextKeyService } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MonacoContextKeyService } from '@opensumi/ide-monaco/lib/browser/monaco.context-key.service';

import { QuickOpenModule } from '../../src/browser';
import { IQuickOpenWidget } from '../../src/browser/quick-open.type';
import { QuickOpenItem, QuickOpenModel, QuickOpenService } from '../../src/common';

describe(__filename, () => {
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
    injector.addProviders(
      {
        token: MonacoContextKeyService,
        useValue: mockService({}),
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
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

  afterEach(() => {
    injector.disposeAll();
  });

  it('show quick-open', () => {
    const $widgetShow = jest.spyOn(widget, 'show');
    quickOpenService.open(model);
    expect(widget.isShow).toBeTruthy();
    expect($widgetShow).toBeCalledTimes(1);
    expect($widgetShow).toBeCalledWith('', {
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
    expect($widgetShow).toBeCalledTimes(1);
    expect($widgetShow).toBeCalledWith('>', {
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
    expect(model.onType).toBeCalledWith('>', expect.anything());
  });

  it('hide quick-open with element select', () => {
    const $widgetHide = jest.spyOn(widget, 'hide');
    const $onClose = jest.fn();
    quickOpenService.open(model, {
      onClose: $onClose,
    });
    quickOpenService.hide(HideReason.ELEMENT_SELECTED);
    expect($widgetHide).toBeCalledTimes(1);
    expect(widget.isShow).toBeFalsy();
    expect($onClose).toBeCalledTimes(1);
    // false 为非取消类型的关闭
    expect($onClose).toBeCalledWith(false);
  });

  it('hide quick-open with element select', () => {
    const $widgetHide = jest.spyOn(widget, 'hide');
    const $onClose = jest.fn();
    quickOpenService.open(model, {
      onClose: $onClose,
    });
    quickOpenService.hide(HideReason.FOCUS_LOST);
    expect($widgetHide).toBeCalledTimes(1);
    expect(widget.isShow).toBeFalsy();
    // true 为取消类型的关闭
    expect($onClose).toBeCalledWith(true);
  });

  it('refresh quick-open', () => {
    quickOpenService.open(model);
    quickOpenService.refresh();
    // refresh 时 onType 会被重新调用
    expect(model.onType).toBeCalledWith(widget.inputValue, expect.anything());
  });

  it('show quick-open decoration', () => {
    quickOpenService.open(model);
    quickOpenService.showDecoration(VALIDATE_TYPE.ERROR);
    expect(widget.validateType).toBe(VALIDATE_TYPE.ERROR);
    quickOpenService.hideDecoration();
    expect(widget.validateType).toBeUndefined();
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
      expect(widget.items).toStrictEqual(items);
    });

    it('match label', () => {
      quickOpenService.open(model, {
        prefix: 'AAA',
        fuzzyMatchLabel: true,
      });
      expect(widget.items).toHaveLength(2);
      expect(widget.items[0].getLabel()).toBe('AAAAA');
      expect(widget.items[1].getLabel()).toBe('AAAAA2');
    });

    it('match label width enableSeparateSubstringMatching', () => {
      quickOpenService.open(model, {
        prefix: 'hld',
        fuzzyMatchLabel: {
          enableSeparateSubstringMatching: true,
        },
      });
      expect(widget.items).toHaveLength(1);
      const [labelHighlights] = widget.items[0].getHighlights();
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
      expect(widget.items).toHaveLength(1);
    });

    it('match description', () => {
      quickOpenService.open(model, {
        prefix: 'BBB',
        fuzzyMatchDescription: true,
      });
      expect(widget.items).toHaveLength(4);
      const [, descriptionHighlights] = widget.items[2].getHighlights();
      expect(descriptionHighlights).toStrictEqual([{ start: 23, end: 26 }]);
    });

    it('match detail', () => {
      quickOpenService.open(model, {
        prefix: 'Hello',
        fuzzyMatchDetail: true,
      });
      expect(widget.items).toHaveLength(4);
      const [, , detailHighlights] = widget.items[3].getHighlights();
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
      expect(widget.items).toHaveLength(2);
      expect(widget.items[0].getLabel()).toBe('Hon');
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
      expect($onSelect).toBeCalledWith(item, 1);
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
      expect($onConfirm).toBeCalledWith([item]);
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
      expect($onClose).toBeCalledWith(false);
    });

    it('onClose to be called when onCancel be called', () => {
      const $onClose = jest.fn();
      quickOpenService.open(model, {
        onClose: $onClose,
        ignoreFocusOut: true,
      });
      // trigger onOk
      widget.callbacks.onCancel();
      expect($onClose).toBeCalledWith(true);
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
      expect($onClose).toBeCalledTimes(0);
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
      expect($onClose).toBeCalledWith(true);
    });
  });
});
