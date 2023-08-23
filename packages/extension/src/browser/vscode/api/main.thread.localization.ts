import { Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { ExtensionNodeServiceServerPath, IExtensionNodeClientService } from '../../../common';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { Uri, UriComponents } from '../../../common/vscode/ext-types';
import { IExtHostLocalization, IMainThreadLocalization } from '../../../common/vscode/localization';

export class MainThreadLocalization implements IMainThreadLocalization {
  protected readonly proxy: IExtHostLocalization;

  @Autowired(IFileServiceClient)
  protected readonly fileService: IFileServiceClient;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeClient: IExtensionNodeClientService;

  private currentLanguage: string;

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostLocalization);
    this.currentLanguage = this.preferenceService.get('general.language', 'en').toLocaleLowerCase();
    this.proxy.$setCurrentLanguage(this.currentLanguage);
  }

  async $fetchBuiltInBundleUri(id: string, language: string): Promise<Uri | undefined> {
    try {
      // 当插件为内置插件时，从 Language Packs 中获取
      const languagePack = this.extensionNodeClient.getLanguagePack(language || this.currentLanguage);
      if (languagePack && languagePack.translations[id]) {
        return Uri.file(languagePack.translations[id]);
      }
      return undefined;
    } catch (e) {
      return undefined;
    }
  }

  async $fetchBundleContents(uriComponents: UriComponents): Promise<string> {
    const contents = await this.fileService.readFile(Uri.revive(uriComponents).fsPath.toString());
    return contents.content.toString();
  }
}
