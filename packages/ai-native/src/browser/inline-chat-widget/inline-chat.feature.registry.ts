import { Injectable, Autowired } from '@opensumi/di';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { CommandRegistry, Disposable, Emitter, IRange, getDebugLogger } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';

import { IInlineChatFeatureRegistry, InlineChatHandler } from '../types';

@Injectable()
export class InlineChatFeatureRegistry extends Disposable implements IInlineChatFeatureRegistry {
  private readonly logger = getDebugLogger();
  private actionsMap: Map<string, AIActionItem> = new Map();
  private handlerMap: Map<string, InlineChatHandler> = new Map();

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  override dispose() {
    super.dispose();
    this.actionsMap.clear();
    this.handlerMap.clear();
  }

  public registerInlineChat(operational: AIActionItem, handler: InlineChatHandler): void {
    const { id } = operational;

    if (this.actionsMap.has(id)) {
      this.logger.warn(`InlineChatFeatureRegistry: id ${id} already exists`);
      return;
    }

    this.actionsMap.set(id, operational);
    this.handlerMap.set(id, handler);

    this.disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: InlineChatFeatureRegistry.getCommandId('editor', id),
        },
        {
          execute: (range: IRange) => {
            this._onActionRun.fire({
              id,
              range,
            });
          },
        },
      ),
    );
  }

  public getActionButtons(): AIActionItem[] {
    return Array.from(this.actionsMap.values()).filter((item) => item.renderType === 'button');
  }

  public getActionMenus(): AIActionItem[] {
    return Array.from(this.actionsMap.values()).filter((item) => item.renderType === 'dropdown');
  }

  public getHandler(id: string): InlineChatHandler | undefined {
    return this.handlerMap.get(id);
  }

  public getAction(id: string): AIActionItem | undefined {
    return this.actionsMap.get(id);
  }

  private readonly _onActionRun = new Emitter<{
    id: string;
    range: IRange;
  }>();
  public readonly onActionRun = this._onActionRun.event;

  static getCommandId(type: 'editor' | 'terminal', id: string) {
    return `ai-native.inline-chat.${type}.${id}`;
  }

  public getCodeActions(): monaco.languages.CodeAction[] {
    return Array.from(this.actionsMap.keys()).map((key) => {
      const aiAction = this.actionsMap.get(key) || ({} as AIActionItem);

      return {
        title: aiAction.name,
        isAI: true,
        isPreferred: true,
        kind: 'InlineChat',
        command: {
          id: InlineChatFeatureRegistry.getCommandId('editor', aiAction.id),
        },
      } as monaco.languages.CodeAction;
    });
  }
}
