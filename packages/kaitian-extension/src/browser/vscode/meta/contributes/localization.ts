// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes, IExtensionNodeClientService, ExtensionNodeServiceServerPath, ExtensionService } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, registerLocalizationBundle, URI, PreferenceService, parseWithComments, getLanguageId } from '@ali/ide-core-browser';
// import { VSCodeExtensionService } from '../types';
import { Path } from '@ali/ide-core-common/lib/path';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';

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

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  // @Autowired(VSCodeExtensionService)
  // vscodeExtensionService: VSCodeExtensionService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(ExtensionNodeServiceServerPath)
  extensionNodeService: IExtensionNodeClientService;

  @Autowired(ExtensionService)
  extensionService: ExtensionService;

  private safeParseJSON(content) {
    let json;
    try {
      json = parseWithComments(content);
      return json;
    } catch (error) {
      return console.error('语言配置文件解析出错！', content);
    }
  }

  async contribute() {
    const currentExtensions = this.extensionService.getExtensions();
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
          promises.push((async () => {
            const contents = await this.registerLanguage(translate);
            registerLocalizationBundle({
              languageId,
              languageName: localization.languageName,
              localizedLanguageName: localization.localizedLanguageName,
              contents,
            }, translate.id);
          })());
        });
      }
    });

    const currentLanguage: string = this.preferenceService.get('general.language') || 'zh-CN';
    promises.push(this.extensionNodeService.updateLanguagePack(currentLanguage, this.extension.path));
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
