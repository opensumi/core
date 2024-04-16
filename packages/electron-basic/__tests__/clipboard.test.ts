import { IClipboardService, URI } from '@opensumi/ide-core-common';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';

import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../tools/dev-tool/src/mock-injector';
import { ElectronClipboardService } from '../src/browser/clipboard';

describe('clipboard service test', () => {
  let injector: MockInjector;
  let clipboardService: IClipboardService;
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
        token: IClipboardService,
        useClass: ElectronClipboardService,
      },
    );
    clipboardService = injector.get<IClipboardService>(IClipboardService);
  });

  it('read text', async () => {
    await clipboardService.writeText('test');
    expect(mockElectronMainUIService.writeClipboardText).toHaveBeenCalledWith('test');
    await clipboardService.readText();
    expect(mockElectronMainUIService.readClipboardText).toHaveBeenCalled();
  });

  it('read resource', async () => {
    await clipboardService.writeResources([new URI('test')]);
    expect(mockElectronMainUIService.writeClipboardBuffer).toHaveBeenCalled();
    await clipboardService.readResources();
    expect(mockElectronMainUIService.readClipboardBuffer).toHaveBeenCalled();

    mockElectronMainUIService.readClipboardBuffer = jest.fn(() => Buffer.from('test'));
    await clipboardService.readResources();
    expect(mockElectronMainUIService.readClipboardBuffer).toHaveBeenCalled();
    mockElectronMainUIService.readClipboardBuffer = jest.fn();
  });

  it('has resource', async () => {
    expect(await clipboardService.hasResources()).toBeFalsy();
    expect(await clipboardService.readResources()).toEqual([]);

    mockElectronMainUIService.readClipboardBuffer = jest.fn(() => Buffer.from('["file://test"]'));
    const flag = await clipboardService.hasResources();
    expect(flag).toBeTruthy();
    mockElectronMainUIService.readClipboardBuffer = jest.fn();
  });
});
