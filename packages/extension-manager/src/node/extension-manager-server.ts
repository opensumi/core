import { Injectable } from '@ali/common-di';
import { IExtensionManagerServer, RawExtension } from '../common';

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {
  search(query: string): Promise<RawExtension[]> {
    throw new Error('Method not implemented.');
  }

}
