import { Injectable, Autowired } from '@opensumi/di';
import {
  ILogger,
  registerLocalizationBundle,
  URI,
  PreferenceService,
  parseWithComments,
  getLanguageId,
  path,
  GeneralSettingsId,
} from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-common';
import { IExtensionStoragePathServer } from '@opensumi/ide-extension-storage';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import {
  VSCodeContributePoint,
  Contributes,
  IExtensionNodeClientService,
  ExtensionNodeServiceServerPath,
  LifeCycle,
} from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

const { Path } = path;

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
@LifeCycle(LifeCyclePhase.Initialize)
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
  private readonly extensionManageService: AbstractExtInstanceManagementService;

  private storagePath: string;

  private safeParseJSON(content) {
    let json;
    try {
      json = parseWithComments(content);
      return json;
    } catch (error) {
      return this.logger.error(`Language configuration file parsing error, ${error.stack}`);
    }
  }

  async contribute() {
    const promises: Promise<void>[] = [];
    const currentLanguage: string = this.preferenceService.get(GeneralSettingsId.Language) || getLanguageId();
    const currentExtensions = this.extensionManageService.getExtensionInstances();

    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      for await (const localization of contributes) {
        if (localization.translations) {
          const languageId = normalizeLanguageId(localization.languageId);
          if (languageId !== getLanguageId()) {
            return;
          }
          promises.push(
            ...localization.translations.map(async (translate) => {
              if (currentExtensions.findIndex((e) => e.id === translate.id) === -1) {
                return;
              }
              const contents = await this.registerLanguage(translate, extension!.path);
              registerLocalizationBundle(
                {
                  languageId,
                  languageName: localization.languageName,
                  localizedLanguageName: localization.localizedLanguageName,
                  contents,
                },
                translate.id,
              );
            }),
          );

          if (!this.storagePath) {
            this.storagePath = (await this.extensionStoragePathServer.getLastStoragePath()) || '';
          }

          promises.push(
            this.extensionNodeService.updateLanguagePack(currentLanguage, extension!.path, this.storagePath),
          );
        }
      }
    }

    await Promise.all(promises);
  }

  async registerLanguage(translate: TranslationFormat, extensionPath: string) {
    const bundlePath = new Path(extensionPath).join(translate.path.replace(/^\.\//, '')).toString();
    const { content } = await this.fileServiceClient.readFile(URI.file(bundlePath).toString());
    const json = this.safeParseJSON(content.toString());

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
