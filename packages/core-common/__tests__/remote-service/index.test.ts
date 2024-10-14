import { Injector } from '@opensumi/di';
import { RemoteService, runInRemoteServiceContext } from '@opensumi/ide-core-common';

describe('RemoteService', () => {
  it('cannot create RemoteService if not in context', () => {
    @RemoteService('test')
    class ARemoteService {}
    const ERROR_MESSAGE = 'Do_Not_Allow_Instantiate_RemoteService';
    const injector = new Injector([ARemoteService]);

    expect(() => {
      injector.get(ARemoteService);
    }).toThrow(ERROR_MESSAGE);

    runInRemoteServiceContext(injector, () => {
      expect(() => {
        const a = injector.get(ARemoteService);
        expect(a).toBeInstanceOf(ARemoteService);

        injector.disposeOne(ARemoteService);
      }).not.toThrow();
    });

    expect(() => {
      injector.get(ARemoteService);
    }).toThrow(ERROR_MESSAGE);
  });
});
