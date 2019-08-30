import { Injectable } from '@ali/common-di';
import { IExtensionManagerServer } from '../common';
import { ExtensionScanner } from '@ali/ide-kaitian-extension/lib/node/extension.scanner';
import { ExtraMetaData, IExtensionMetaData } from '@ali/ide-kaitian-extension';

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {
  async getExtension(extensionPath: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined> {
    return await ExtensionScanner.getExtension(extensionPath, extraMetaData);
    return undefined;
  }

}
