import { WorkbenchEditorService, IResourceOpenOptions, IUntitledOptions, IOpenResourceResult } from '../editor';
import { URI, Emitter, MaybeNull, Event } from '@opensumi/ide-core-common';
import { Injectable } from '@opensumi/di';
import { IResource } from '../resource';
import { IEditorGroup } from '../../browser';

@Injectable()
export class MockWorkbenchEditorService extends WorkbenchEditorService {
  private readonly _onActiveResourceChange = new Emitter<MaybeNull<IResource>>();
  public readonly onActiveResourceChange: Event<MaybeNull<IResource>> = this._onActiveResourceChange.event;

  private readonly _onDidEditorGroupsChanged = new Emitter<void>();
  public readonly onDidEditorGroupsChanged: Event<void> = this._onDidEditorGroupsChanged.event;

  private readonly _onDidCurrentEditorGroupChanged = new Emitter<IEditorGroup>();
  public readonly onDidCurrentEditorGroupChanged: Event<IEditorGroup> = this._onDidCurrentEditorGroupChanged.event;

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

  setEditorContextKeyService() {
    throw new Error('Method not implemented.');
  }
}
