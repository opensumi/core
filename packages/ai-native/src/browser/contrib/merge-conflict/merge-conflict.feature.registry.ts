import { Injectable } from '@opensumi/di';
import {
  Disposable,
  IInternalResolveConflictRegistry,
  IResolveConflictHandler,
  MergeConflictEditorMode,
} from '@opensumi/ide-core-common';

import { IResolveConflictRegistry } from '../../types';

@Injectable()
export class ResolveConflictRegistry
  extends Disposable
  implements IResolveConflictRegistry, IInternalResolveConflictRegistry
{
  private readonly providerMap = new Map<MergeConflictEditorMode, IResolveConflictHandler>();

  registerResolveConflictProvider(editorMode: MergeConflictEditorMode, handler: IResolveConflictHandler): void {
    if (this.providerMap.has(editorMode)) {
      throw new Error(`Conflict provider for ${editorMode} already exists`);
    }

    this.providerMap.set(editorMode, handler);
  }

  getThreeWayHandler(): IResolveConflictHandler | undefined {
    return this.providerMap.get(MergeConflictEditorMode['3way']);
  }

  getTraditionalHandler(): IResolveConflictHandler | undefined {
    return this.providerMap.get(MergeConflictEditorMode.traditional);
  }
}
