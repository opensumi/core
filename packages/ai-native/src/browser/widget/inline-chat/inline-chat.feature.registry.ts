import { Autowired, Injectable } from '@opensumi/di';
import { Logger } from '@opensumi/ide-core-browser';
import { AIActionItem, AICodeActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import {
  CommandRegistry,
  CommandService,
  Disposable,
  Emitter,
  IDisposable,
  IRange,
  isUndefined,
} from '@opensumi/ide-core-common';
import { CodeAction } from '@opensumi/ide-monaco';

import { IEditorInlineChatHandler, IInlineChatFeatureRegistry, ITerminalInlineChatHandler } from '../../types';

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  @Autowired(Logger)
  private readonly logger: Logger;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  private actionsMap: Map<string, AIActionItem> = new Map();
  private codeActionsMap = new Map<string, Partial<AICodeActionItem>>();
  private editorHandlerMap: Map<string, IEditorInlineChatHandler> = new Map();
  private terminalHandlerMap: Map<string, ITerminalInlineChatHandler> = new Map();

  override dispose() {
    super.dispose();
    this.actionsMap.clear();
    this.editorHandlerMap.clear();
  }

  private readonly _onActionRun = new Emitter<{
    id: string;
    range: IRange;
  }>();
  public readonly onActionRun = this._onActionRun.event;

  static getCommandId(type: 'editor' | 'terminal', id: string) {
    return `ai-native.inline-chat.${type}.${id}`;
  }

  private collectActions(type: 'editor' | 'terminal', operational: AIActionItem): boolean {
    const { id } = operational;

    if (this.actionsMap.has(id)) {
      this.logger.warn(`InlineChatFeatureRegistry: id ${id} already exists`);
      return false;
    }

    this.disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: InlineChatFeatureRegistry.getCommandId(type, id),
        },
        {
          execute: async (range: IRange) => {
            this._onActionRun.fire({
              id,
              range,
            });
          },
        },
      ),
    );

    this.actionsMap.set(id, operational);

    if (operational.codeAction) {
      this.codeActionsMap.set(id, operational.codeAction);
    }

    return true;
  }

  private removeCollectedActions(type: 'editor' | 'terminal', operational: AIActionItem): void {
    this.actionsMap.delete(operational.id);
    this.codeActionsMap.delete(operational.id);

    this.commandRegistry.unregisterCommand(InlineChatFeatureRegistry.getCommandId(type, operational.id));
  }

  public registerEditorInlineChat(operational: AIActionItem, handler: IEditorInlineChatHandler): IDisposable {
    const isCollect = this.collectActions('editor', operational);

    if (isCollect) {
      this.editorHandlerMap.set(operational.id, handler);
    }

    return {
      dispose: () => {
        this.removeCollectedActions('editor', operational);
      },
    };
  }

  public registerTerminalInlineChat(operational: AIActionItem, handler: ITerminalInlineChatHandler): IDisposable {
    const isCollect = this.collectActions('terminal', operational);

    if (isCollect) {
      if (isUndefined(handler.triggerRules)) {
        handler.triggerRules = 'selection';
      }

      this.terminalHandlerMap.set(operational.id, handler);
    }

    return {
      dispose: () => {
        this.removeCollectedActions('terminal', operational);
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

  public getCodeActions(): CodeAction[] {
    return Array.from(this.codeActionsMap.keys()).map((key) => {
      const aiAction = this.actionsMap.get(key) || ({} as AIActionItem);
      const codeAction = this.codeActionsMap.get(key) || {};

      return {
        title: codeAction.title || aiAction.name,
        isAI: true,
        isPreferred: codeAction.isPreferred ?? true,
        kind: codeAction.kind || 'InlineChat',
        disabled: codeAction.disabled,
        command: {
          id: InlineChatFeatureRegistry.getCommandId('editor', aiAction.id),
        },
      } as CodeAction;
    });
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
