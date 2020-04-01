import { WorkbenchEditorService, IResourceOpenOptions, IUntitledOptions, IOpenResourceResult } from '../editor';
import { URI } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';

@Injectable()
export class MockWorkbenchEditorService extends WorkbenchEditorService {

  async closeAll(uri?: URI, force?: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async open(uri: URI, options?: IResourceOpenOptions): Promise<IOpenResourceResult> {
    throw new Error('Method not implemented.');
  }

  async openUris(uri: URI[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  saveAll(includeUntitled?: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async close(uri: any, force?: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getAllOpenedUris(): URI[] {
    throw new Error('Method not implemented.');
  }

  // 创建一个带待存的资源
  createUntitledResource(options?: IUntitledOptions): Promise<IOpenResourceResult> {
    throw new Error('Method not implemented.');
  }
}
