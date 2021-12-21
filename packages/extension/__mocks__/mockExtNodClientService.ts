import { Injectable } from '@opensumi/di';
import { IExtensionNodeClientService, IExtraMetaData, IExtensionMetaData } from '@opensumi/ide-extension';
import { mockExtensions, mockExtensionProps } from './extensions';

@Injectable()
export class MockExtNodeClientService implements IExtensionNodeClientService {
  getElectronMainThreadListenPath(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getAllExtensions(): Promise<IExtensionMetaData[]> {
    return Promise.resolve(mockExtensions);
  }
  createProcess(): Promise<void> {
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
  disposeClientExtProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  updateLanguagePack(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
