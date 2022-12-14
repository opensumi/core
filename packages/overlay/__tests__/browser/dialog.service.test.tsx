import { act } from 'react-dom/test-utils';

import { IContextKeyService } from '@opensumi/ide-core-browser';
import { createBrowserApp, MockClientApp } from '@opensumi/ide-dev-tool/src/injector-helper';

import { OverlayModule } from '../../src/browser';
import { IDialogService } from '../../src/common';

describe.skip('packages/overlay/src/browser/dialog.service.ts', () => {
  let app: MockClientApp;
  let dialogService: IDialogService;

  beforeAll(async () => {
    app = await createBrowserApp([OverlayModule]);
    app.injector.addProviders({
      token: IContextKeyService,
      useValue: {
        match: () => true,
      },
    });
    dialogService = app.injector.get<IDialogService>(IDialogService);
  });

  afterAll(() => {
    act(() => {
      dialogService.reset();
    });
  });

  function $$(className: string) {
    return document.querySelectorAll(className);
  }
  it('open a info dialog', () => {
    act(() => {
      dialogService.info('hello info');
    });

    expect($$('.ant-modal')).toHaveLength(1);
    expect($$('.ant-modal-body span')[0].innerHTML).toBe('hello info');
  });

  it('open a error dialog', () => {
    act(() => {
      dialogService.error('hello error');
    });

    expect($$('.ant-modal')).toHaveLength(1);
    expect($$('.ant-modal-body span')[0].innerHTML).toBe('hello error');
  });

  it('open a warning dialog', () => {
    act(() => {
      dialogService.warning('hello warning');
    });

    expect($$('.ant-modal')).toHaveLength(1);
    expect($$('.ant-modal-body span')[0].innerHTML).toBe('hello warning');
  });

  it('hide dialog', () => {
    act(() => {
      dialogService.info('hello info');
      dialogService.hide();
    });
    expect(dialogService.isVisible()).toBe(false);
  });

  it('get field', () => {
    act(() => {
      dialogService.info('hello', ['btnA', 'btnB'], undefined, { className: 'dialog-class-test' });
    });

    expect($$('.ant-modal')).toHaveLength(1);
    expect($$('.dialog-class-test')).toHaveLength(1);
    expect(dialogService.getMessage()).toBe('hello');
    expect(dialogService.isVisible()).toBe(true);
    expect(dialogService.getIcon()!.className).toBe('info-circle');
    expect(dialogService.getButtons()).toEqual(['btnA', 'btnB']);
    expect(dialogService.getProps()).toEqual({ className: 'dialog-class-test' });
  });

  it.skip('select btn', (done) => {
    act(() => {
      dialogService.info('hello', ['btnA', 'btnB']).then((select) => {
        expect(select).toBe('btnA');
        done();
      });
    });
    const btnA = $$('.ant-btn')[0] as HTMLElement;
    btnA.click();
  });

  it('close dialog will recieve undefined', (done) => {
    act(() => {
      dialogService.info('hello', ['btnA', 'btnB']).then((select) => {
        expect(select).toBe(undefined);
        done();
      });
      dialogService.hide();
    });
  });
});
