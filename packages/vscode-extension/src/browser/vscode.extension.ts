import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optinal } from '@ali/common-di';
import { IFeatureExtensionType, IFeatureExtension, FeatureExtensionCapability, JSONSchema, FeatureExtensionManagerService } from '@ali/ide-feature-extension/lib/browser';
import { IDisposable, registerLocalizationBundle, getLogger } from '@ali/ide-core-browser';
import { ContributesSchema, VscodeContributesRunner } from './contributes';
import { LANGUAGE_BUNDLE_FIELD } from './types';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier, VSCodeExtensionNodeServiceServerPath, VSCodeExtensionNodeService } from '../common';
import {MainThreadCommands} from './api/mainThreadCommands';

@Injectable()
export class VscodeExtensionType implements IFeatureExtensionType<VscodeJSONSchema> {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  public readonly name = 'vscode-extension';

  public isThisType(packageJSON: { [key: string]: any; }): boolean {
    return packageJSON.engines && packageJSON.engines.vscode;
  }

  createCapability(extension: IFeatureExtension): VscodeExtensionCapability {
    return this.injector.get(VscodeExtensionCapability, [extension]);
  }

}

@Injectable({multiple: true})
export class VscodeExtensionCapability extends FeatureExtensionCapability<VscodeJSONSchema> {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  public async onEnable(): Promise<IDisposable> {
    if (this.extension.extraMetadata[LANGUAGE_BUNDLE_FIELD]) {
      try {
        const bundle = JSON.parse(this.extension.extraMetadata[LANGUAGE_BUNDLE_FIELD]!);
        registerLocalizationBundle({
          locale: 'zh-CN',
          messages: bundle,
        });
        // todo unregister i18n
      } catch (e) {
        getLogger().error(e);
      }
    }
    const { contributes } = this.packageJSON;
    const runner = this.injector.get(VscodeContributesRunner, [contributes]);
    runner.run();
    return runner;
  }

  public onActivate(): Promise<IDisposable> {
    throw new Error('Method not implemented.');
  }

}

export interface VscodeJSONSchema extends JSONSchema {

  contributes: ContributesSchema;

}

@Injectable()
export class VSCodeExtensionService {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(VSCodeExtensionNodeServiceServerPath)
  private vscodeService: VSCodeExtensionNodeService;

  constructor(@Optinal(Symbol()) private extensionService: FeatureExtensionManagerService) {

  }

  public async createExtensionHostProcess() {
    const extPath = await this.vscodeService.getExtHostPath();

    const extForkOptions = {
      execArgv: ['--inspect=9992'],
    };

    await this.extensionService.createFeatureExtensionNodeProcess('vscode', extPath, ['--testarg=1'], extForkOptions);
    await this.setMainThreadAPI();
  }

  private async setMainThreadAPI() {
    this.extensionService.setupAPI((protocol) => {
      protocol.set(MainThreadAPIIdentifier.MainThreadCommands, this.injector.get(MainThreadCommands, [protocol]));
    });
  }
  public async activeExtension() {
    const proxy = this.extensionService.getProxy(ExtHostAPIIdentifier.ExtHostExtensionService);
    const extension = await proxy.$getExtension();
    console.log('activeExtension extension[0].path', extension[0].path);
    await proxy.$activateExtension(extension[0].path);
  }
}
