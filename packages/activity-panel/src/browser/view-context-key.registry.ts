import { Injectable } from '@ali/common-di';
import { IContextKey, IContextKeyService } from '@ali/ide-core-browser';

@Injectable()
export class ViewContextKeyRegistry {
  private contextKeyMap: Map<string, IContextKeyService> = new Map();

  getContextKeyService(viewId: string) {
    return this.contextKeyMap.get(viewId);
  }

  registerContextKeyService(viewId: string, contextKeyService: IContextKeyService): IContextKeyService {
    this.contextKeyMap.set(viewId, contextKeyService);
    return contextKeyService;
  }
}
