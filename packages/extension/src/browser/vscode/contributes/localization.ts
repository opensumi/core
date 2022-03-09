import { Injectable, Autowired } from '@opensumi/di';
import {
  ILogger,
  registerLocalizationBundle,
  URI,
  PreferenceService,
  parseWithComments,
  getLanguageId,
} from '@opensumi/ide-core-browser';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { IExtensionStoragePathServer } from '@opensumi/ide-extension-storage';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import {
  VSCodeContributePoint,
  Contributes,
  IExtensionNodeClientService,
  ExtensionNodeServiceServerPath,
} from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export interface TranslationFormat {
  id: string;
  path: string;
}

export interface LocalizationFormat {
  languageId: string;

  languageName: string;

  localizedLanguageName: string;

  translations: TranslationFormat[];
}

export type LocalizationsSchema = Array<LocalizationFormat>;

@Injectable()
@Contributes('localizations')
export class LocalizationsContributionPoint extends VSCodeContributePoint<LocalizationsSchema> {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IExtensionStoragePathServer)
  private readonly extensionStoragePathServer: IExtensionStoragePathServer;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeService: IExtensionNodeClientService;

  @Autowired(AbstractExtInstanceManagementService)
  private readonly extensionInstanceManageService: AbstractExtInstanceManagementService;

  private safeParseJSON(content) {
    let json;
    try {
      json = parseWithComments(content);
      return json;
    } catch (error) {
      return this.logger.error('语言配置文件解析出错！', content);
    }
  }

  async contribute() {
    const currentExtensions = this.extensionInstanceManageService.getExtensionInstances();
    const promises: Promise<void>[] = [];
    this.json.forEach((localization) => {
      if (localization.translations) {
        const languageId = normalizeLanguageId(localization.languageId);
        if (languageId !== getLanguageId()) {
          return;
        }
        localization.translations.map((translate) => {
          if (currentExtensions.findIndex((e) => e.id === translate.id) === -1) {
            return;
          }
          promises.push(
            (async () => {
              const contents = await this.registerLanguage(translate);
              registerLocalizationBundle(
                {
                  languageId,
                  languageName: localization.languageName,
                  localizedLanguageName: localization.localizedLanguageName,
                  contents,
                },
                translate.id,
              );
            })(),
          );
        });
      }
    });

    const currentLanguage: string = this.preferenceService.get('general.language') || 'zh-CN';
    const storagePath = (await this.extensionStoragePathServer.getLastStoragePath()) || '';
    promises.push(this.extensionNodeService.updateLanguagePack(currentLanguage, this.extension.path, storagePath));
    await Promise.all(promises);
  }

  async registerLanguage(translate: TranslationFormat) {
    const bundlePath = new Path(this.extension.path).join(translate.path.replace(/^\.\//, '')).toString();
    const { content } = await this.fileServiceClient.resolveContent(URI.file(bundlePath).toString());
    const json = this.safeParseJSON(content);

    const contents = {};
    if (json.contents) {
      for (const path of Object.keys(json.contents)) {
        if (json.contents[path]) {
          for (const key of Object.keys(json.contents[path])) {
            contents[key] = json.contents[path][key];
          }
        }
      }
    }

    return contents;
  }
}

/**
 * zh-cn -> zh-CN
 * en-us -> en-US
 * ja -> ja
 * @param id
 */
function normalizeLanguageId(id: string) {
  const parts = id.split('-');
  if (parts[1]) {
    parts[1] = parts[1].toUpperCase();
  }
  return parts.join('-');
}
