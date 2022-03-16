import { act } from 'react-dom/test-utils';

import { createBrowserApp, MockClientApp } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IDialogService } from '@opensumi/ide-overlay';
import { OverlayModule } from '@opensumi/ide-overlay/lib/browser';

describe.skip('packages/overlay/src/browser/dialog.service.ts', () => {
  let app: MockClientApp;
  let dialogService: IDialogService;

  beforeAll(async (done) => {
    app = await createBrowserApp([OverlayModule]);
    dialogService = app.injector.get<IDialogService>(IDialogService);
    done();
  });

  afterEach(() => {
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
      dialogService.info('hello', ['btnA', 'btnB']);
    });

    expect($$('.ant-modal')).toHaveLength(1);
    expect(dialogService.getMessage()).toBe('hello');
    expect(dialogService.isVisible()).toBe(true);
    expect(dialogService.getIcon()!.className).toBe('info-circle');
    expect(dialogService.getButtons()).toEqual(['btnA', 'btnB']);
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
