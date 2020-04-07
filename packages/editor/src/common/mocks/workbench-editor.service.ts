import { WorkbenchEditorService, IResourceOpenOptions, IUntitledOptions, IOpenResourceResult } from '../editor';
import { URI, Emitter, MaybeNull, Event } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';
import { IResource } from '../resource';

@Injectable()
export class MockWorkbenchEditorService extends WorkbenchEditorService {

  private readonly _onActiveResourceChange = new Emitter<MaybeNull<IResource>>();
  public readonly onActiveResourceChange: Event<MaybeNull<IResource>> = this._onActiveResourceChange.event;

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
