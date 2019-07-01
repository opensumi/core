import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IFeatureExtensionType, IFeatureExtension, FeatureExtensionCapability, JSONSchema } from '@ali/ide-feature-extension/lib/browser';
import { IDisposable, registerLocalizationBundle, getLogger } from '@ali/ide-core-browser';
import { ContributesSchema, VscodeContributesRunner } from './contributes';
import { LANGUAGE_BUNDLE_FIELD } from './types';

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
