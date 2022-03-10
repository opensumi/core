import { ILoggerManagerClient } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IClipboardService } from '../../src/services';

describe(__filename, () => {
  let injector: MockInjector;
  let clipboardService: IClipboardService;
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: ILoggerManagerClient,
      useValue: {
        getLogger: () => ({
          log() {},
          debug() {},
          error() {},
          verbose() {},
          warn() {},
        }),
      },
    });
    clipboardService = injector.get<IClipboardService>(IClipboardService);
  });

  it('read text', async () => {
    await clipboardService.writeText('test');
    const text = await clipboardService.readText();
    expect(text).toBe('test');
  });
});
