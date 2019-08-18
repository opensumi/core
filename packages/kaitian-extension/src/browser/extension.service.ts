import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ExtensionService,
         ExtensionNodeServiceServerPath,
         ExtensionNodeService,
         IExtraMetaData,
         IExtensionMetaData,
         ExtensionCapabilityRegistry,
         LANGUAGE_BUNDLE_FIELD,
         /*Extension*/
        } from '../common';
import {AppConfig} from '@ali/ide-core-browser';
import {Extension} from './extension';

@Injectable()
export class ExtensionServiceImpl implements ExtensionService {
  private extensionScanDir: string[] = [];
  private extenionCandidate: string[] = [];
  private extraMetadata: IExtraMetaData = {};

  // @Autowired(ExtensionCapabilityRegistry)
  // private registry: ExtensionCapabilityRegistry

  @Autowired(ExtensionNodeServiceServerPath)
  private extensionNodeService: ExtensionNodeService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  public extensionMap: Map<string, Extension> = new Map();

  public async activate(): Promise<void> {
    console.log('ExtensionServiceImpl active');
    await this.initBaseData();
    const extensionMetaDataArr = await this.getAllExtensions();
    console.log('kaitian extensionMetaDataArr', extensionMetaDataArr);

    await this.initExtension(extensionMetaDataArr);

  }

  public async getAllExtensions(): Promise<IExtensionMetaData[]> {
    return this.extensionNodeService.getAllExtensions(this.extensionScanDir, this.extenionCandidate, this.extraMetadata);
  }

  private async initBaseData() {
    if (this.appConfig.extensionDir) {
      this.extensionScanDir.push(this.appConfig.extensionDir);
    }
    this.extraMetadata[LANGUAGE_BUNDLE_FIELD] = './package.nls.json';
  }

  private async initExtension(extensionMetaDataArr: IExtensionMetaData[]) {
    for (const extensionMetaData of extensionMetaDataArr) {
      const extension = this.injector.get(Extension, [
        extensionMetaData,
      ]);
      console.log('extensionMetaData', extensionMetaData);

      this.extensionMap.set(extensionMetaData.path, extension);
    }

    await Promise.all(Array.from(this.extensionMap.values()).map((extension) => {
      return extension.enable();
    }));

  }
}

// @Injectable()
// export class ExtensionCapabilityRegistryImpl implements ExtensionCapabilityRegistry {

//   @Autowired(ExtensionNodeServiceServerPath)
//   private extensionNodeService: ExtensionNodeService

// }
