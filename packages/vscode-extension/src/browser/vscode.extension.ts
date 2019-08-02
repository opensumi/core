import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IFeatureExtensionType, IFeatureExtension, FeatureExtensionCapability, JSONSchema, FeatureExtensionManagerService } from '@ali/ide-feature-extension/lib/browser';
import { IDisposable, registerLocalizationBundle, getLogger, Deferred, Disposable, ILogger } from '@ali/ide-core-browser';
import { ContributesSchema, VscodeContributesRunner } from './contributes';
import { LANGUAGE_BUNDLE_FIELD, VSCodeExtensionService } from './types';
import { createApiFactory } from './api/main.thread.api.impl';
import { VSCodeExtensionNodeServiceServerPath, VSCodeExtensionNodeService, ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '../common';
import { ActivationEventService } from '@ali/ide-activation-event';
import { IRPCProtocol, RPCProtocol } from '@ali/ide-connection';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileSearchServicePath, IFileSearchService } from '@ali/ide-search/lib/common';

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

export interface VscodeJSONSchema extends JSONSchema {

  contributes: ContributesSchema;

  activationEvents: string[] | undefined;

}

export interface ExtensionInitializationData {
  logPath: string;
  storagePath: string | undefined;
  globalStoragePath: string;
  [key: string]: any;
}
@Injectable()
export class VSCodeExtensionServiceImpl implements VSCodeExtensionService {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(VSCodeExtensionNodeServiceServerPath)
  private vscodeService: VSCodeExtensionNodeService;

  private ready: Deferred<any> = new Deferred();

  @Autowired()
  private activationService: ActivationEventService;

  private protocol: IRPCProtocol;

  constructor() {

  }

  get extensionService(): FeatureExtensionManagerService {
    return this.injector.get(FeatureExtensionManagerService);
  }

  async getProxy(identifier): Promise<any> {
    await this.ready.promise;
    return this.protocol.getProxy(identifier);
  }

  public async createExtensionHostProcess(initialData: ExtensionInitializationData) {
    const extPath = await this.vscodeService.getExtHostPath();

    const extForkOptions = {
      // stdio: 'inherit' as any
    };
    await this.extensionService.createFeatureExtensionNodeProcess('vscode', extPath, ['--testarg=1'], extForkOptions, (rpcProtocol) => {
      this.setServiceAPI(rpcProtocol);
    });

    await this.setMainThreadAPI();

    this.ready.resolve();

    this.activationService.fireEvent('*');
  }
  private async setServiceAPI(rpcProtocol: RPCProtocol) {
    rpcProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionServie, this);
  }
  private async setMainThreadAPI() {
    return new Promise((resolve) => {
      this.extensionService.setupAPI((protocol) => {
        this.protocol = protocol;
        createApiFactory(protocol, this.injector, this);
        resolve();
      });
    });
  }

  public async $getCandidates() {
    const candidates = await this.extensionService.getCandidates();
    return candidates;
  }

  public async $getFeatureExtensions() {
    return await this.extensionService.getFeatureExtensions();
  }

  public async activeExtension(extension: IFeatureExtension) {
    await this.ready.promise;
    const proxy = this.extensionService.getProxy(ExtHostAPIIdentifier.ExtHostExtensionService);
    // const extension = await proxy.$getExtension();

    console.log('activeExtension path', extension.path);
    await proxy.$activateExtension(extension.id);

  }
}

@Injectable({multiple: true})
export class VscodeExtensionCapability extends FeatureExtensionCapability<VscodeJSONSchema> {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(VSCodeExtensionService)
  private service: VSCodeExtensionServiceImpl;

  @Autowired()
  private activationService: ActivationEventService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(FileSearchServicePath)
  private fileSearchService: IFileSearchService;

  @Autowired(ILogger)
  private logger: ILogger;

  public async onEnable(): Promise<IDisposable> {
    if (this.extension.extraMetadata[LANGUAGE_BUNDLE_FIELD]) {
      try {
        const bundle = JSON.parse(this.extension.extraMetadata[LANGUAGE_BUNDLE_FIELD]!);
        registerLocalizationBundle({
          languageId: 'zh-CN',
          languageName: '中文',
          localizedLanguageName: '中文',
          contents: bundle,
        });
        // todo unregister i18n
      } catch (e) {
        getLogger().error(e);
      }
    }
    const { contributes } = this.packageJSON;
    const runner = this.injector.get(VscodeContributesRunner, [contributes]);
    runner.run(this.extension);

    // bind activation event;
    const { activationEvents = [] } = this.packageJSON;
    const activateDisposer = new Disposable();
    activationEvents.forEach((event) => {
      this.activationService.onEvent(event, async () => {
        await this.extension.activate();
        activateDisposer.dispose();
      });
    });

    this.activateByWorkspaceContains(activationEvents);
    return {
      dispose: () => {
        runner.dispose();
        activateDisposer.dispose();
      },
    };
  }

  public async onActivate(): Promise<IDisposable> {
    await this.service.activeExtension(this.extension);
    return {
      dispose: () => {
        return null; // todo dispose;
      },
    };
  }

  private async activateByWorkspaceContains(activationEvents: string[]) {

    const paths: string[] = [];
    const includePatterns: string[] = [];
    for (const activationEvent of activationEvents) {
      if (/^workspaceContains:/.test(activationEvent)) {
        const fileNameOrGlob = activationEvent.substr('workspaceContains:'.length);
        if (fileNameOrGlob.indexOf('*') >= 0 || fileNameOrGlob.indexOf('?') >= 0) {
          includePatterns.push(fileNameOrGlob);
        } else {
          paths.push(fileNameOrGlob);
        }
      }
    }

    const promises: Promise<boolean>[] = [];
    if (paths.length) {
      promises.push(this.workspaceService.containsSome(paths));
    }

    if (includePatterns.length) {
      promises.push((async () => {
        try {
          const result = await this.fileSearchService.find('', {
            rootUris: this.workspaceService.tryGetRoots().map((r) => r.uri),
            includePatterns,
            limit: 1,
          });
          return result.length > 0;
        } catch (e) {
          this.logger.error(e);
          return false;
        }
      })());
    }

    if (promises.length && await Promise.all(promises).then((exists) => exists.some((v) => v))) {
      this.activationService.fireEvent('workspaceContains', [...paths, ...includePatterns][0]);
    }
  }

}
