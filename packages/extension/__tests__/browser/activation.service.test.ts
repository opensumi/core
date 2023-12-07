import { ILogger } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ExtensionModule } from '../../src/browser';
import { IActivationEventService } from '../../src/browser/types';

describe('activation event test', () => {
  let injector;
  let service: IActivationEventService;

  beforeAll(() => {
    injector = createBrowserInjector([ExtensionModule]);
    injector.overrideProviders({
      token: ILogger,
      useValue: {
        error: jest.fn(),
      },
    });
    service = injector.get(IActivationEventService);
  });

  it('normal event should be listened', async () => {
    let executed = 0;
    let disposer;

    disposer = service.onEvent('onCommand:A', () => {
      executed++;
      disposer.dispose();
    });

    await service.fireEvent('onCommand', 'A');
    expect(executed).toEqual(1);

    await service.fireEvent('onCommand', 'A');
    expect(executed).toEqual(1);

    disposer = service.onEvent('onCommand:B', () => {
      executed++;
      disposer.dispose();
    });

    await service.fireEvent('onCommand', 'B');
    expect(executed).toEqual(2);
  });

  it('wildcard event should be listened', async () => {
    let executed = 0;

    service.addWildCardTopic('wildCard');

    const disposer = service.onEvent('wildCard:*.js', () => {
      executed++;
    });

    await service.fireEvent('wildCard', 'a.js');
    expect(executed).toEqual(1);

    await service.fireEvent('wildCard', 'b.js');
    expect(executed).toEqual(2);

    await service.fireEvent('wildCard', 'a.xjs');
    expect(executed).toEqual(2);

    disposer.dispose();
    await service.fireEvent('wildCard', 'a.js');
    expect(executed).toEqual(2);

    service.onEvent('wildCard:**/.a', () => {
      executed++;
    });

    await service.fireEvent('wildCard', 'b/c/.a');
    expect(executed).toEqual(3);
  });
});
