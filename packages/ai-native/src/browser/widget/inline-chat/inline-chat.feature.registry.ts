import { Autowired, Injectable } from '@opensumi/di';
import { KeybindingRegistry, Logger } from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/interactive-input/index';
import { Disposable, Emitter, Event, IDisposable, MaybePromise, isUndefined, uuid } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { CodeActionService } from '../../contrib/code-action/code-action.service';
import {
  ERunStrategy,
  IEditorInlineChatHandler,
  IInlineChatFeatureRegistry,
  IInteractiveInputHandler,
  IInteractiveInputRunStrategy,
  ITerminalInlineChatHandler,
} from '../../types';

type TRunStrategyFn = (editor: ICodeEditor, value: string) => MaybePromise<ERunStrategy>;

class InteractiveInputModel {
  static ID: string = `${InteractiveInput.displayName}:${uuid(4)}`;

  private _handler: IInteractiveInputHandler | undefined;
  private _strategyHandler: TRunStrategyFn;

  public setHandler(h: IInteractiveInputHandler): void {
    this._handler = h;
  }

  public handler(): IInteractiveInputHandler | undefined {
    return this._handler;
  }

  public setStrategyHandler(fn: TRunStrategyFn): void {
    this._strategyHandler = fn;
  }

  public strategyHandler(): TRunStrategyFn {
    return this._strategyHandler;
  }

  public dispose(): void {
    this._handler = undefined;
  }
}

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  @Autowired(Logger)
  private readonly logger: Logger;

  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  private actionsMap: Map<string, AIActionItem> = new Map();
  private editorHandlerMap: Map<string, IEditorInlineChatHandler> = new Map();
  private terminalHandlerMap: Map<string, ITerminalInlineChatHandler> = new Map();

  private interactiveInputModel: InteractiveInputModel = new InteractiveInputModel();

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
    return InteractiveInputModel.ID;
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

  public unregisterEditorInlineChat(operational: AIActionItem) {
    return this.removeCollectedActions(operational);
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

  public unregisterTerminalInlineChat(operational: AIActionItem) {
    return this.removeCollectedActions(operational);
  }

  public registerInteractiveInput(
    runStrategy: IInteractiveInputRunStrategy,
    handler: IInteractiveInputHandler,
  ): IDisposable {
    this.interactiveInputModel.setHandler(handler);

    if (runStrategy.handleStrategy) {
      this.interactiveInputModel.setStrategyHandler(runStrategy.handleStrategy);
    } else {
      this.interactiveInputModel.setStrategyHandler(() => runStrategy.strategy || ERunStrategy.EXECUTE);
    }

    this.addDispose(
      Event.filter(this.keybindingRegistry.onKeybindingsChanged, ({ affectsCommands }) =>
        affectsCommands.includes(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id),
      )(() => {
        const keybindingStr = String(this.getSequenceKeyString());
        if (keybindingStr) {
          this.collectActions({
            id: InteractiveInputModel.ID,
            name: `Chat(${keybindingStr.toLocaleUpperCase()})`,
            renderType: 'button',
            order: Number.MAX_SAFE_INTEGER,
          });
        }
      }),
    );

    return {
      dispose: () => {
        this.interactiveInputModel.dispose();
      },
    };
  }

  private getSequenceKeyString() {
    const keybindings = this.keybindingRegistry.getKeybindingsForCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id);
    const resolved = keybindings[0]?.resolved;
    if (!resolved) {
      return '';
    }
    return this.keybindingRegistry.acceleratorForSequence(resolved, '+');
  }

  public getInteractiveInputHandler(): IInteractiveInputHandler | undefined {
    return this.interactiveInputModel.handler();
  }

  public getInteractiveInputStrategyHandler(): TRunStrategyFn {
    return this.interactiveInputModel.strategyHandler();
  }

  public getEditorActionButtons(): AIActionItem[] {
    const actions = Array.from(this.editorHandlerMap.keys())
      .filter((id) => {
        const actions = this.actionsMap.get(id);
        return actions && actions.renderType === 'button';
      })
      .map((id) => this.actionsMap.get(id)!)
      .sort((a, b) => a.order! - b.order!);

    if (this.actionsMap.has(InteractiveInputModel.ID)) {
      actions.push(this.actionsMap.get(InteractiveInputModel.ID)!);
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
