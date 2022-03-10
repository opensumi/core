import { IContextKeyService, QuickOpenMode, QuickPickService } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MonacoContextKeyService } from '@opensumi/ide-monaco/lib/browser/monaco.context-key.service';
import { IThemeService, IIconService } from '@opensumi/ide-theme';

import { QuickOpenModule } from '../../src/browser';
import { IQuickOpenWidget } from '../../src/browser/quick-open.type';
import { QuickOpenService } from '../../src/common';


describe(__filename, () => {
  let injector: MockInjector;
  let quickPickService: QuickPickService;
  let container: HTMLDivElement;
  let quickOpenService: QuickOpenService;
  let widget: IQuickOpenWidget;

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
      {
        token: IThemeService,
        useValue: mockService({}),
      },
      {
        token: IIconService,
        useValue: mockService({}),
      },
    );
    quickOpenService = injector.get(QuickOpenService);
    // 以下 initWidgetView 与 widget 为私有变量
    // @ts-ignore
    jest.spyOn<any, any>(quickOpenService, 'initWidgetView').mockImplementation();
    widget = (quickOpenService as any).widget;
    quickPickService = injector.get(QuickPickService);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('show quick-open', (done) => {
    quickPickService.show(['sumi', 'vscode']).then((item) => {
      expect(item).toBe('sumi');
      done();
    });
    const [item] = widget.items;
    item.run(QuickOpenMode.OPEN);
  });

  it('show quick-open with canPickMany', (done) => {
    quickPickService
      .show(['sumi', 'vscode'], {
        canPickMany: true,
      })
      .then((items) => {
        expect(items).toHaveLength(2);
        expect(items![0]).toBe('sumi');
        expect(items![1]).toBe('vscode');
        done();
      });
    widget.callbacks.onConfirm(widget.items);
  });
});
