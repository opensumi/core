import { ExtensionNodeService, IExtensionCandidate, ExtensionNodeServiceServerPath } from '../src/common';
import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { FeatureExtensionModule, FeatureExtensionCapabilityContribution, FeatureExtensionCapabilityRegistry, FeatureExtensionCapability, FeatureExtensionManagerService } from '../src/browser';
import { Injectable } from '@ali/common-di';
import { Domain, IDisposable } from '@ali/ide-core-node';
import { IThemeService } from '@ali/ide-theme';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { ILoggerManageClient } from '@ali/ide-core-common';

@Injectable()
export class MockLoggerManageClient {
  getLogger() {
    return console;
  }
}
@Injectable()
export class MockFileService {}
@Injectable()
export class MockedNodeExtensionService implements ExtensionNodeService {

  getExtServerListenPath(name: string): string {
    throw new Error('Method not implemented.');
  }
  getElectronMainThreadListenPath(name: string): string {
    throw new Error('Method not implemented.');
  }
  createProcess(name: string, preload: string, args?: string[] | undefined, options?: any) {
    throw new Error('Method not implemented.');
  }

  async getAllCandidatesFromFileSystem(scan: string[], candidate: string[], extraMetaData: { [key: string]: string; }): Promise<IExtensionCandidate[]> {
    return [
      {
        realPath: '/path/to/invalid-extension',
        path: '/path/to/extension',
        packageJSON: {
          'name': 'extension',
          'isExtension': true,
        },
        extraMetaData: {
          'metadata': '1',
        },
      },
      {
        path: '/path/to/invalid-extension',
        packageJSON: {
          'name': 'not-an-extension',
        },
        extraMetaData: {},
        realPath: '/path/to/invalid-extension',
      },
    ];

  }
  public async resolveConnection(name: string) {
    throw new Error('Method not implemented.');
  }
  public async resolveProcessInit(name: string) {
    throw new Error('Method not implemented.');
  }
}

@Domain(FeatureExtensionCapabilityContribution)
export class TestFeatureExtensionCapabilityContribution implements FeatureExtensionCapabilityContribution {

  async registerCapability(registry: FeatureExtensionCapabilityRegistry) {
    registry.registerFeatureExtensionType({
      name: 'testExtension',
      isThisType: (packageJSON: any) => {
        return packageJSON.isExtension === true;
      },
      createCapability: (extension) => {
        return new TestFeatureExtensionCapability(extension);
      },
    });
  }
}

const EnabledCapabilities: string[] = [];

export class TestFeatureExtensionCapability extends FeatureExtensionCapability {

  public isActivated = false;

  public async onEnable(): Promise<IDisposable> {
    EnabledCapabilities.push(this.extension.name);
    return {
      dispose: () => {
        const i = EnabledCapabilities.indexOf(this.extension.name);
        if (i !== -1) {
          EnabledCapabilities.splice(i, 1);
        }
      },
    };
  }

  public async onActivate(): Promise<IDisposable> {
    this.isActivated = true;
    return {
      dispose: () => {
        this.isActivated = false;
      },
    };
  }

}

describe.only('feature extension basic', () => {

  const injector = createBrowserInjector([FeatureExtensionModule]);
  injector.overrideProviders({
    token: ExtensionNodeServiceServerPath,
    useClass: MockedNodeExtensionService,
  });
  injector.addProviders(TestFeatureExtensionCapabilityContribution);
  injector.addProviders({
    token: 'FileService',
    useClass: MockFileService,
  });
  injector.addProviders({
    token: IThemeService,
    useClass: WorkbenchThemeService,
  });

  injector.addProviders({
    token: ILoggerManageClient,
    useClass: MockLoggerManageClient,
  });

  it('should be able to recognize extensions', async () => {

    const service: FeatureExtensionManagerService = injector.get(FeatureExtensionManagerService);
    await service.activate();

    expect(service.getFeatureExtensions()).toHaveLength(1);

    const extension = service.getFeatureExtension('extension');

    expect(extension).not.toBeUndefined();
    expect(extension.activated).toBeFalsy();
    expect(extension.path).toEqual('/path/to/extension');
    expect(extension.extraMetadata.metadata).toEqual('1');

    // TODO 修改enable逻辑后修改这里测试断言
    expect(extension.enabled).toBeTruthy();
    expect(EnabledCapabilities).toContain(extension.name);

  });

});
