import { Autowired, Injectable } from '@opensumi/di';
import { KeybindingRegistry, Logger } from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { Disposable, Event, IDisposable, formatLocalize, isUndefined } from '@opensumi/ide-core-common';

import { CodeActionService } from '../../contrib/code-action/code-action.service';
import {
  IEditorInlineChatHandler,
  IInlineChatFeatureRegistry,
  IInteractiveInputHandler,
  IInteractiveInputRunStrategy,
  ITerminalInlineChatHandler,
} from '../../types';
import { InlineInputService } from '../inline-input/inline-input.service';
import { InteractiveInputModel } from '../inline-input/model';

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  @Autowired(Logger)
  private readonly logger: Logger;

  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  @Autowired(InlineInputService)
  private readonly inlineInputService: InlineInputService;

  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

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
    const doCollect = () => {
      const keybindingStr = String(this.inlineInputService.getSequenceKeyString());
      if (!keybindingStr) {
        return;
      }

      const operational: AIActionItem = {
        id: InteractiveInputModel.ID,
        name: formatLocalize('aiNative.inline.chat.operate.chat.title', keybindingStr.toLocaleUpperCase()),
        renderType: 'button',
        order: Number.MAX_SAFE_INTEGER,
      };

      if (this.actionsMap.has(operational.id)) {
        this.actionsMap.set(operational.id, operational);
      } else {
        this.collectActions(operational);
      }
    };

    this.addDispose(
      Event.filter(this.keybindingRegistry.onKeybindingsChanged, ({ affectsCommands }) =>
        affectsCommands.includes(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id),
      )(() => doCollect()),
    );

    doCollect();

    return this.inlineInputService.registerInlineInput(runStrategy, handler);
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
