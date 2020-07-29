import { Injectable } from '@ali/common-di';
import { IExtensionNodeClientService, ExtraMetaData, IExtensionMetaData } from '@ali/ide-kaitian-extension';
import { nodeLessExtensions } from '../extensions';

@Injectable()
export class ExtensionClientService implements IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  async getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: ExtraMetaData): Promise<IExtensionMetaData[]> {
    return nodeLessExtensions;
  }
  createProcess(clientId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData | undefined): Promise<IExtensionMetaData | undefined> {
    throw new Error('Method not implemented.');
  }
  infoProcessNotExist(): void {
    throw new Error('Method not implemented.');
  }
  infoProcessCrash(): void {
    throw new Error('Method not implemented.');
  }
  disposeClientExtProcess(clientId: string, info: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }
  updateLanguagePack(languageId: string, languagePackPath: string, storagePath: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

}
