import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, registerLocalizationBundle } from '@ali/ide-core-browser';
import { VSCodeExtensionService } from '../types';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import * as JSON5 from 'json5';

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
export class LocalizationsContributionPoint extends VscodeContributionPoint<LocalizationsSchema> {

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(VSCodeExtensionService)
  vscodeExtensionService: VSCodeExtensionService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired()
  private fileServiceClient: FileServiceClient;

  private safeParseJSON(content) {
    let json;
    try {
      json = JSON5.parse(content);
      return json;
    } catch (error) {
      return console.error('语言配置文件解析出错！', content);
    }
  }

  contribute() {
    this.json.forEach((localization) => {
      if (localization.translations) {
        localization.translations.forEach(async (translate) => {
          const contents = await this.registerLanguage(translate);
          registerLocalizationBundle({
            languageId: localization.languageId,
            languageName: localization.languageName,
            localizedLanguageName: localization.localizedLanguageName,
            contents,
          });
        });
      }
    });
  }

  async registerLanguage(translate: TranslationFormat) {
    const bundlePath = new Path(this.extension.path).join(translate.path.replace(/^\.\//, '')).toString();
    const { content } = await this.fileServiceClient.resolveContent('file://' + bundlePath);
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
