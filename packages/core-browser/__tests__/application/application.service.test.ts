import { IApplicationService, CommonServerPath, OS } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ApplicationService } from '../../src/application/application.service';

describe('packages/core-browser/src/application/application.service.ts', () => {
  let applicationService: IApplicationService & { initializeData(): Promise<void> };
  const hostOSType = OS.type();

  beforeAll(() => {
    const injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: CommonServerPath,
        useValue: {
          async getBackendOS() {
            return Promise.resolve('fakeOS');
          },
        },
      },
      {
        token: IApplicationService,
        useClass: ApplicationService,
      },
    );
    applicationService = injector.get(IApplicationService);
  });

  it('get frontend os', () => {
    expect(applicationService.frontendOS).toBe(hostOSType);
  });

  it('get backend os', () => {
    expect(() => applicationService.backendOS).toThrow();
  });

  it('async get backend os', async () => {
    await applicationService.initializeData();
    expect(applicationService.getBackendOS()).resolves.toBe('fakeOS');
  });
});

describe('packages/core-browser/src/application/application.service.ts electronRenderer', () => {
  let applicationService: IApplicationService & { initializeData(): Promise<void> };
  const hostOSType = OS.type();

  beforeAll(() => {
    global.isElectronRenderer = true;
    const injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: CommonServerPath,
        useValue: {
          async getBackendOS() {
            // make sure backend os fallback to electronRender
            return Promise.resolve('');
          },
        },
      },
      {
        token: IApplicationService,
        useClass: ApplicationService,
      },
    );
    applicationService = injector.get(IApplicationService);
  });

  it('get frontend os', () => {
    expect(applicationService.frontendOS).toBe(hostOSType);
  });

  it('get backend os', async () => {
    await applicationService.initializeData();
    expect(await applicationService.getBackendOS()).toBe(hostOSType);
  });
});

declare global {
  namespace NodeJS {
    interface Global {
      isElectronRenderer: boolean;
    }
  }
}
