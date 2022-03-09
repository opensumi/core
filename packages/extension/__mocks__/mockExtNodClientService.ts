import { Injectable } from '@opensumi/di';
import { IExtensionNodeClientService, IExtraMetaData, IExtensionMetaData } from '@opensumi/ide-extension';

import { mockExtensions, mockExtensionProps } from './extensions';

@Injectable()
export class MockExtNodeClientService implements IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getAllExtensions(
    scan: string[],
    extensionCandidate: string[],
    localization: string,
    extraMetaData: IExtraMetaData,
  ): Promise<IExtensionMetaData[]> {
    return Promise.resolve(mockExtensions);
  }
  createProcess(clientId: string): Promise<void> {
    return Promise.resolve();
  }
  getExtension(
    extensionPath: string,
    localization: string,
    extraMetaData?: IExtraMetaData | undefined,
  ): Promise<IExtensionMetaData | undefined> {
    return Promise.resolve({ ...mockExtensionProps, extraMetadata: { ...extraMetaData } });
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
  updateLanguagePack(languageId: string, languagePackPath: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
