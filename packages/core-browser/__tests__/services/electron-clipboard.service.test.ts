import { URI } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IElectronMainUIService } from '../../../core-common/lib/electron';
import { ElectronClipboardService, INativeClipboardService } from '../../src/services';

describe('clipboard service test', () => {
  let injector: MockInjector;
  let clipboardService: INativeClipboardService;
  const mockElectronMainUIService = {
    writeClipboardText: jest.fn(),
    readClipboardText: jest.fn(),
    readClipboardBuffer: jest.fn(),
    writeClipboardBuffer: jest.fn(),
  };
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.overrideProviders(
      {
        token: IElectronMainUIService,
        useValue: mockElectronMainUIService,
      },
      {
        token: INativeClipboardService,
        useClass: ElectronClipboardService,
      },
    );
    clipboardService = injector.get<INativeClipboardService>(INativeClipboardService);
  });

  it('read text', async () => {
    await clipboardService.writeText('test');
    expect(mockElectronMainUIService.writeClipboardText).toBeCalledWith('test');
    await clipboardService.readText();
    expect(mockElectronMainUIService.readClipboardText).toBeCalled();
  });

  it('read resouce', async () => {
    await clipboardService.writeResources([new URI('test')]);
    expect(mockElectronMainUIService.writeClipboardBuffer).toBeCalled();
    await clipboardService.readResources();
    expect(mockElectronMainUIService.readClipboardBuffer).toBeCalled();
  });
});
