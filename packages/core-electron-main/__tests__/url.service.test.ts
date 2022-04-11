import { MockInjector } from '../../../tools/dev-tool/src/mock-injector';
import { ElectronURLService } from '../src/bootstrap/services/url';

describe('electron main url handler tests', () => {
  it('Register url handlers', async () => {
    const injector = new MockInjector();

    const electronURLService: ElectronURLService = injector.get(ElectronURLService);

    electronURLService.registerDefaultHandler({
      async handleURL(url: string) {
        return true;
      },
    });

    electronURLService.registerHandler({
      async handleURL(url: string) {
        if (url.startsWith('sumi:')) {
          return true;
        }
        return false;
      },
    });

    electronURLService.registerHandler({
      async handleURL(url: string) {
        return false;
      },
    });

    expect(electronURLService.getHandlers().length).toBe(2);

    expect(electronURLService.open('sumi://extension.git/clone?url=git@github.com:example/example.git')).toBeTruthy();

    expect(
      electronURLService.open('sumi-dev://extension.git/clone?url=git@github.com:example/example.git'),
    ).toBeTruthy();
  });
});
