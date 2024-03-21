import { Injectable } from '@opensumi/di';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { Disposable, getDebugLogger, isUndefined } from '@opensumi/ide-core-common';

import { IEditorInlineChatHandler, IInlineChatFeatureRegistry, ITerminalInlineChatHandler } from '../../types';

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  private readonly logger = getDebugLogger();
  private actionsMap: Map<string, AIActionItem> = new Map();
  private editorHandlerMap: Map<string, IEditorInlineChatHandler> = new Map();
  private terminalHandlerMap: Map<string, ITerminalInlineChatHandler> = new Map();

  override dispose() {
    super.dispose();
    this.actionsMap.clear();
    this.editorHandlerMap.clear();
  }

  private collectActions(operational: AIActionItem): boolean {
    const { id } = operational;

    if (this.actionsMap.has(id)) {
      this.logger.warn(`InlineChatFeatureRegistry: id ${id} already exists`);
      return false;
    }

    this.actionsMap.set(id, operational);
    return true;
  }

  public registerEditorInlineChat(operational: AIActionItem, handler: IEditorInlineChatHandler): void {
    const isCollect = this.collectActions(operational);

    if (isCollect) {
      this.editorHandlerMap.set(operational.id, handler);
    }
  }

  public registerTerminalInlineChat(operational: AIActionItem, handler: ITerminalInlineChatHandler): void {
    const isCollect = this.collectActions(operational);

    if (isCollect) {
      if (isUndefined(handler.triggerRules)) {
        handler.triggerRules = 'selection';
      }

      this.terminalHandlerMap.set(operational.id, handler);
    }
  }

  public getEditorActionButtons(): AIActionItem[] {
    return Array.from(this.editorHandlerMap.keys())
      .filter((id) => {
        const actions = this.actionsMap.get(id);
        return actions && actions.renderType === 'button';
      })
      .map((id) => this.actionsMap.get(id)!);
  }

  public getEditorActionMenus(): AIActionItem[] {
    return Array.from(this.editorHandlerMap.keys())
      .filter((id) => {
        const actions = this.actionsMap.get(id);
        return actions && actions.renderType === 'dropdown';
      })
      .map((id) => this.actionsMap.get(id)!);
  }

  public getEditorHandler(id: string): IEditorInlineChatHandler | undefined {
    return this.editorHandlerMap.get(id);
  }

  public getTerminalHandler(id: string): ITerminalInlineChatHandler | undefined {
    return this.terminalHandlerMap.get(id);
  }

  public getTerminalActions(): AIActionItem[] {
    return Array.from(this.terminalHandlerMap.keys()).map((id) => this.actionsMap.get(id)!);
  }

  public getAction(id: string): AIActionItem | undefined {
    return this.actionsMap.get(id);
  }
}
