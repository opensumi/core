import { Autowired, Injectable } from '@opensumi/di';
import { Logger, SpecialCases } from '@opensumi/ide-core-browser';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/interactive-input/index';
import { Disposable, Emitter, Event, IDisposable, isUndefined, uuid } from '@opensumi/ide-core-common';

import { CodeActionService } from '../../contrib/code-action/code-action.service';
import {
  IEditorInlineChatHandler,
  IInlineChatFeatureRegistry,
  IInteractiveInputHandler,
  ITerminalInlineChatHandler,
} from '../../types';

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  @Autowired(Logger)
  private readonly logger: Logger;

  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  private actionsMap: Map<string, AIActionItem> = new Map();
  private editorHandlerMap: Map<string, IEditorInlineChatHandler> = new Map();
  private terminalHandlerMap: Map<string, ITerminalInlineChatHandler> = new Map();
  private interactiveInputHandler: IInteractiveInputHandler | undefined;
  private interactiveInputId: string = `${InteractiveInput.displayName}:${uuid(4)}`;

  public readonly _onChatClick = new Emitter<void>();
  public readonly onChatClick: Event<void> = this._onChatClick.event;

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

    if (isUndefined(operational.renderType)) {
      operational.renderType = 'button';
    }

    if (isUndefined(operational.order)) {
      operational.order = 0;
    }

    this.actionsMap.set(id, operational);

    return true;
  }

  private removeCollectedActions(operational: AIActionItem): void {
    this.actionsMap.delete(operational.id);
    this.codeActionService.deleteCodeActionById(operational.id);
  }

  public getInteractiveInputId(): string {
    return this.interactiveInputId;
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

  public registerInteractiveInput(handler: IInteractiveInputHandler): IDisposable {
    this.interactiveInputHandler = handler;

    this.collectActions({
      id: this.interactiveInputId,
      name: `Chat(${SpecialCases.MACMETA}+K)`,
      renderType: 'button',
      order: Number.MAX_SAFE_INTEGER,
    });

    return {
      dispose: () => {
        this.interactiveInputHandler = undefined;
      },
    };
  }

  public getInteractiveInputHandler(): IInteractiveInputHandler | undefined {
    return this.interactiveInputHandler;
  }

  public getEditorActionButtons(): AIActionItem[] {
    const actions = Array.from(this.editorHandlerMap.keys())
      .filter((id) => {
        const actions = this.actionsMap.get(id);
        return actions && actions.renderType === 'button';
      })
      .map((id) => this.actionsMap.get(id)!)
      .sort((a, b) => a.order! - b.order!);

    if (this.actionsMap.has(this.interactiveInputId)) {
      actions.push(this.actionsMap.get(this.interactiveInputId)!);
    }

    return actions;
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
