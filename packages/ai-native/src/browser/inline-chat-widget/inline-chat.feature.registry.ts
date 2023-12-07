import { Injectable } from '@opensumi/di';
import { Disposable, getDebugLogger } from '@opensumi/ide-core-common';

import { IInlineChatFeatureRegistry, InlineChatAction, InlineChatHandler } from '../types';

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  private readonly logger = getDebugLogger();
  private actionsMap: Map<string, InlineChatAction> = new Map();
  private handlerMap: Map<string, InlineChatHandler> = new Map();

  override dispose() {
    super.dispose();
    this.actionsMap.clear();
    this.handlerMap.clear();
  }

  public registerInlineChat(operational: InlineChatAction, handler: InlineChatHandler): void {
    const { id } = operational;

    if (this.actionsMap.has(id)) {
      this.logger.warn(`InlineChatFeatureRegistry: id ${id} already exists`);
      return;
    }

    this.actionsMap.set(id, operational);
    this.handlerMap.set(id, handler);
  }

  public getActionButtons(): InlineChatAction[] {
    return Array.from(this.actionsMap.values()).filter((item) => item.renderType === 'button');
  }

  public getActionMenus(): InlineChatAction[] {
    return Array.from(this.actionsMap.values()).filter((item) => item.renderType === 'dropdown');
  }

  public getHandler(id: string): InlineChatHandler | undefined {
    return this.handlerMap.get(id);
  }

  public getAction(id: string): InlineChatAction | undefined {
    return this.actionsMap.get(id);
  }
}
