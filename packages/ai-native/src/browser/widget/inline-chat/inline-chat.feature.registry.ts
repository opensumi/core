import { Autowired, Injectable } from '@opensumi/di';
import { Logger } from '@opensumi/ide-core-browser';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { Disposable, IDisposable, isUndefined } from '@opensumi/ide-core-common';

import { CodeActionService } from '../../contrib/code-action/code-action.service';
import { IEditorInlineChatHandler, IInlineChatFeatureRegistry, ITerminalInlineChatHandler } from '../../types';

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  @Autowired(Logger)
  private readonly logger: Logger;

  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  private actionsMap: Map<string, AIActionItem> = new Map();
  private editorHandlerMap: Map<string, IEditorInlineChatHandler> = new Map();
  private terminalHandlerMap: Map<string, ITerminalInlineChatHandler> = new Map();

  override dispose() {
    super.dispose();
    this.actionsMap.clear();
    this.editorHandlerMap.clear();
    this.terminalHandlerMap.clear();
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

  private removeCollectedActions(operational: AIActionItem): void {
    this.actionsMap.delete(operational.id);
  }

  public registerEditorInlineChat(operational: AIActionItem, handler: IEditorInlineChatHandler): IDisposable {
    const isCollect = this.collectActions(operational);

    if (isCollect) {
      this.editorHandlerMap.set(operational.id, handler);
      this.codeActionService.registerCodeAction(operational);
    }

    return {
      dispose: () => {
        this.removeCollectedActions(operational);
      },
    };
  }

  public registerTerminalInlineChat(operational: AIActionItem, handler: ITerminalInlineChatHandler): IDisposable {
    const isCollect = this.collectActions(operational);

    if (isCollect) {
      if (isUndefined(handler.triggerRules)) {
        handler.triggerRules = 'selection';
      }

      this.terminalHandlerMap.set(operational.id, handler);
    }

    return {
      dispose: () => {
        this.removeCollectedActions(operational);
      },
    };
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
