import { IExtensionNodeClientService, IExtraMetaData, IExtensionMetaData, IExtension } from '../src/common';
import { mockExtensionProps } from './extensions';
import { Injectable } from '@opensumi/di';

const mockExtensions: IExtension[] = [
  {
    ...mockExtensionProps,
    contributes: mockExtensionProps.packageJSON.contributes,
    activate: () => true,
    reset() {},
    enable() {},
    toJSON: () => mockExtensionProps,
  },
];

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
  updateLanguagePack(languageId: string): Promise<void> {
    process.env['TEST_KAITIAN_LANGUAGE_ID'] = languageId;
    return Promise.resolve();
  }
}
