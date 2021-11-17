import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ApplicationService } from '../../src/application/application.service';
import { IApplicationService, CommonServerPath, OS } from '@ide-framework/ide-core-common';

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
            return Promise.resolve(OS.type());
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

  it('async get backend os', async () => {
    expect(applicationService.getBackendOS()).resolves.toBe(hostOSType);
  });

  it('get backend os', async () => {
    expect(() => applicationService.backendOS).toThrow();
    global.isElectronRenderer = true;
    expect(applicationService.backendOS).toBe(hostOSType);
    global.isElectronRenderer = false;
    await applicationService.initializeData();
    expect(applicationService.backendOS).toBe(hostOSType);
  });
});

declare global {
  namespace NodeJS {
    interface Global {
      isElectronRenderer: boolean;
    }
  }
}
