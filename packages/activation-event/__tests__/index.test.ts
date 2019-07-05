import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { ActivationEventModule, ActivationEventService } from '../src/browser';

describe('activation event test', () => {

  const injector = createBrowserInjector([ActivationEventModule]);
  const service: ActivationEventService = injector.get(ActivationEventService);

  it('normal event should be listened', async (done) => {

    let executed = 0;

    const disposer = service.onEvent('onCommand:A', () => {
      executed ++;
    });

    await service.fireEvent('onCommand', 'A');
    expect(executed).toEqual(1);

    disposer.dispose();
    await service.fireEvent('onCommand', 'A');
    expect(executed).toEqual(1);

    service.onEvent('*', () => {
      executed ++;
    });

    await service.fireEvent('*');
    expect(executed).toEqual(2);

    done();
  });

  it('wildcard event should be listened', async (done) => {

    let executed = 0;

    service.addWildCardTopic('wildCard');

    const disposer = service.onEvent('wildCard:*.js', () => {
      executed ++;
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
      executed ++;
    });

    await service.fireEvent('wildCard', 'b/c/.a');
    expect(executed).toEqual(3);

    done();
  });

});
