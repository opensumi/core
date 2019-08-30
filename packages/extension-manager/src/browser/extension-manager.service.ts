import { Injectable, Autowired } from '@ali/common-di';
import { IExtensionManagerService, RawExtension, ExtensionDetail, ExtensionManagerServerPath, IExtensionManagerServer } from '../common';
import { ExtensionService, IExtensionMetaData } from '@ali/ide-kaitian-extension/lib/common';
import { action, observable, computed } from 'mobx';
import { Path } from '@ali/ide-core-common/lib/path';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { URI, ILogger, replaceLocalizePlaceholder } from '@ali/ide-core-browser';

@Injectable()
export class ExtensionManagerService implements IExtensionManagerService {

  @Autowired()
  protected extensionService: ExtensionService;

  @Autowired()
  protected staticResourceService: StaticResourceService;

  @Autowired(ExtensionManagerServerPath)
  private extensionManagerServer: IExtensionManagerServer;

  @Autowired(ILogger)
  private logger: ILogger;

  @observable
  extensions: IExtensionMetaData[] = [];

  @observable
  loading: boolean = false;

  private isInit: boolean = false;

  static defaultIconUrl = '//gw.alipayobjects.com/mdn/rms_883dd2/afts/img/A*TKtCQIToMwgAAAAAAAAAAABkARQnAQ';

  search(query: string): Promise<RawExtension[]> {
    throw new Error('Method not implemented.');
  }

  @action
  async init() {
    // this.loading = true;
    // 获取所有已安装的插件
    const extensions = await this.extensionService.getAllExtensions();
    console.log(extensions);
    this.extensions = extensions;
    this.loading = false;
    this.isInit = true;
  }

  @computed
  get installed() {
    return this.rawExtension;
  }

  get rawExtension() {
    return this.extensions.map((extension) => {

      const { displayName, description } = this.getI18nInfo(extension);

      return {
        id: `${extension.packageJSON.publisher}.${extension.packageJSON.name}`,
        name: extension.packageJSON.name,
        displayName,
        version: extension.packageJSON.version,
        description,
        publisher: extension.packageJSON.publisher,
        installed: true,
        icon: this.getIconFromExtension(extension),
        path: extension.realPath,
        engines: {
          vscode: extension.packageJSON.engines.vscode,
          kaitian: '',
        },
      };
    });
  }

  async getRawExtensionById(extensionId: string): Promise<RawExtension> {
    // 说明是刚进入页面看到了上次打开的插件详情窗口，需要先调用初始化
    if (!this.isInit) {
      await this.init();
    }

    return this.rawExtension.find((extension) => extension.id === extensionId)!;
  }

  async getDetailById(extensionId: string): Promise<ExtensionDetail> {

    const extension = await this.getRawExtensionById(extensionId);

    const extensionDetail = await this.extensionManagerServer.getExtension(extension!.path, {
      readme: './README.md',
      changelog: './CHANGELOG.md',
    });
    const readme = extensionDetail.extraMetadata.readme
                  ? extensionDetail.extraMetadata.readme
                  : `# ${extension.displayName}\n${extension.description}`;

    console.log('extensionDetail', extensionDetail);

    return {
      ...extension,
      readme,
      changelog: extensionDetail.extraMetadata.changelog,
      license: '',
      categories: '',
      isActive: true,
      contributes: {
        a: '',
      },
    };
  }

  private getI18nInfo(extension: IExtensionMetaData): { description: string, displayName: string} {
    let displayName = extension.packageJSON.displayName;
    let description = extension.packageJSON.description;

    if (extension.extraMetadata.languageBundle) {
      try {
        const language = JSON.parse(extension.extraMetadata.languageBundle);
        displayName = replaceLocalizePlaceholder(language.displayName);
        description = replaceLocalizePlaceholder(language.description);
      } catch (e) {
        this.logger.error('parse languageBundle throw a Error', e.message);
      }
    }

    return {
      description,
      displayName,
    };

  }

  private getIconFromExtension(extension: IExtensionMetaData): string {
    const icon = extension.packageJSON.icon
              ? this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.realPath).join(extension.packageJSON.icon).toString())).toString()
              : ExtensionManagerService.defaultIconUrl;
    return icon;
  }

}
