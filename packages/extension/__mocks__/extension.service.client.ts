import { Injectable } from '@opensumi/di';

import { MOCK_EXTENSIONS } from '../__tests__/browser/extension-service/extension-service-mock-helper';
import { IExtensionNodeClientService, IExtraMetaData, IExtensionMetaData } from '../src/common';

import { mockExtensionProps } from './extensions';

@Injectable()
export class MockExtNodeClientService implements IExtensionNodeClientService {
  async setupNLSConfig(languageId: string, storagePath: string): Promise<void> {
    // void
  }
  getOpenVSXRegistry(): Promise<string> {
    return Promise.resolve('');
  }
  getElectronMainThreadListenPath(clientId: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string): Promise<IExtensionMetaData[]> {
    return Promise.resolve(MOCK_EXTENSIONS);
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
    process.env['TEST_KAITIAN_LANGUAGE_ID'] = languageId;
    return Promise.resolve();
  }
  getLanguagePack(languageId: string) {
    return undefined;
  }
}
