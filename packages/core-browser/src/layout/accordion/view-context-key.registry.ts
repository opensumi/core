import { Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-core-common';

import { IContextKeyService } from '../../context-key';

@Injectable()
export class ViewContextKeyRegistry {
  private contextKeyMap: Map<string, IContextKeyService> = new Map();

  private _onViewContextKeyServiceRegistered = new Emitter<string>();

  getContextKeyService(viewId: string) {
    return this.contextKeyMap.get(viewId);
  }

  registerContextKeyService(viewId: string, contextKeyService: IContextKeyService): IContextKeyService {
    this.contextKeyMap.set(viewId, contextKeyService);
    this._onViewContextKeyServiceRegistered.fire(viewId);
    return contextKeyService;
  }

  afterContextKeyServiceRegistered(viewId: string, callback: (contextKeyService: IContextKeyService) => any) {
    if (!this.contextKeyMap.has(viewId)) {
      const disposer = this._onViewContextKeyServiceRegistered.event((id) => {
        if (id === viewId) {
          disposer.dispose();
          callback(this.getContextKeyService(viewId)!);
        }
      });
    } else {
      callback(this.getContextKeyService(viewId)!);
    }
  }
}
