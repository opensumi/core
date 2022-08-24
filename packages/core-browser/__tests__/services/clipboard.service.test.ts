import { ILoggerManagerClient } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IClipboardService } from '../../src/services';

describe('clipboard service test', () => {
  let injector: MockInjector;
  let clipboardService: IClipboardService;
  beforeAll(() => {
    injector = createBrowserInjector([]);
    clipboardService = injector.get<IClipboardService>(IClipboardService);
  });

  it('read text', async () => {
    await clipboardService.writeText('test');
    const text = await clipboardService.readText();
    expect(text).toBe('test');
  });
});
