import { Disposable } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { RemoteOpenerBrowserServiceImpl } from '../../../remote-opener/lib/browser';
import { IRemoteHostConverter } from '../../src/common';
import { IRemoteOpenerBrowserService, RemoteOpenerBrowserServiceToken } from '../../src/common';

describe('packages/core-browser/src/remote-opener/converter.contribution.ts', () => {
  let remoteOpenerService: IRemoteOpenerBrowserService;

  beforeEach(() => {
    const injector = createBrowserInjector([]);
    injector.addProviders({
      token: RemoteOpenerBrowserServiceToken,
      useClass: RemoteOpenerBrowserServiceImpl,
    });
    remoteOpenerService = injector.get(RemoteOpenerBrowserServiceToken);
  });

  it('register remote host converter', () => {
    const disposes = new Disposable();
    const converter: IRemoteHostConverter = {
      convert: (port) => `opensumi-${port}-ide.com`,
    };
    disposes.addDispose(remoteOpenerService.registerConverter(converter));
    disposes.addDispose(remoteOpenerService.registerSupportHosts(['localhost', '127.0.0.1', '0.0.0.0']));
    expect(remoteOpenerService['converter']).toBeDefined();
    expect(remoteOpenerService['converter'].convert('3030')).toBe('opensumi-3030-ide.com');

    const converter2: IRemoteHostConverter = {
      convert: (port) => `opensumi-${port}-ide.net`,
    };

    expect(() => remoteOpenerService.registerConverter(converter2)).toThrow(
      new Error('Only one converter is allowed.'),
    );
    disposes.dispose();
  });

  it('register support remote host', () => {
    const disposes = new Disposable();
    disposes.addDispose(remoteOpenerService.registerSupportHosts(['localhost', '127.0.0.1', '0.0.0.0']));
    disposes.addDispose(remoteOpenerService.registerSupportHosts(['128.168.0.1', '0.0.0.1']));
    expect(remoteOpenerService['supportHosts'].size).toBe(5);
    expect(remoteOpenerService['supportHosts'].has('0.0.0.0')).toBeTruthy();
    expect(remoteOpenerService['supportHosts'].has('255.255.255.0')).toBeFalsy();
    disposes.dispose();
  });
});
