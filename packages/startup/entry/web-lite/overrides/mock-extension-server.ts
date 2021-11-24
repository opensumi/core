import { Injectable } from '@opensumi/di';
import { IExtensionNodeClientService, IExtraMetaData, IExtensionMetaData } from '@opensumi/ide-extension/lib/common';
import { nodeLessExtensions } from '../extensions';

@Injectable()
export class ExtensionClientService implements IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  async getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: IExtraMetaData): Promise<IExtensionMetaData[]> {
    return nodeLessExtensions;
  }
  createProcess(clientId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getExtension(extensionPath: string, localization: string, extraMetaData?: IExtraMetaData | undefined): Promise<IExtensionMetaData | undefined> {
    throw new Error('Method not implemented.');
  }
  restartExtProcessByClient(): void {
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
