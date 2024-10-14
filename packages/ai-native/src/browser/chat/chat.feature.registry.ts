import { Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event, getDebugLogger } from '@opensumi/ide-core-common';

import { IChatWelcomeMessageContent, ISampleQuestions, SLASH_SYMBOL } from '../../common';
import { IChatFeatureRegistry, IChatSlashCommandHandler, IChatSlashCommandItem } from '../types';

import { ChatSlashCommandItemModel, ChatWelcomeMessageModel } from './chat-model';
import { ChatProxyService } from './chat-proxy.service';

@Injectable()
export class ChatFeatureRegistry extends Disposable implements IChatFeatureRegistry {
  private readonly logger = getDebugLogger();
  private slashCommandsMap: Map<string, ChatSlashCommandItemModel> = new Map();
  private slashCommandsHandlerMap: Map<string, IChatSlashCommandHandler> = new Map();

  public chatWelcomeMessageModel?: ChatWelcomeMessageModel;

  private _onDidWelcomeMessageChange: Emitter<void> = new Emitter<void>();
  public onDidWelcomeMessageChange: Event<void> = this._onDidWelcomeMessageChange.event;

  override dispose() {
    super.dispose();
    this.slashCommandsMap.clear();
    this.slashCommandsHandlerMap.clear();
  }

  registerWelcome(content: IChatWelcomeMessageContent, sampleQuestions: ISampleQuestions[]): void {
    this.chatWelcomeMessageModel = new ChatWelcomeMessageModel(content, sampleQuestions);
    this._onDidWelcomeMessageChange.fire();
  }

  registerSlashCommand(command: IChatSlashCommandItem, handler: IChatSlashCommandHandler): void {
    const { name } = command;

    if (this.slashCommandsMap.has(name)) {
      this.logger.warn(`ChatFeatureRegistry: commands name ${name} already exists`);
      return;
    }

    this.slashCommandsMap.set(name, new ChatSlashCommandItemModel(command, name, ChatProxyService.AGENT_ID));
    this.slashCommandsHandlerMap.set(name, handler);
  }

  public getSlashCommandHandler(name: string): IChatSlashCommandHandler | undefined {
    return this.slashCommandsHandlerMap.get(name);
  }

  public getSlashCommand(name: string): ChatSlashCommandItemModel | undefined {
    return this.slashCommandsMap.get(name);
  }

  public getSlashCommandHandlerBySlashName(slashName: string): IChatSlashCommandHandler | undefined {
    const findCommand = this.getAllSlashCommand().find((item) => item.nameWithSlash === slashName);
    if (!findCommand) {
      return;
    }

    return this.getSlashCommandHandler(findCommand.name);
  }

  public getSlashCommandBySlashName(slashName: string): ChatSlashCommandItemModel | undefined {
    const findCommand = this.getAllSlashCommand().find((item) => item.nameWithSlash === slashName);
    if (!findCommand) {
      return;
    }

    return this.getSlashCommand(findCommand.name);
  }

  public getAllSlashCommand(): ChatSlashCommandItemModel[] {
    return Array.from(this.slashCommandsMap.values());
  }

  public getAllShortcutSlashCommand(): ChatSlashCommandItemModel[] {
    return this.getAllSlashCommand().filter((c) => c.isShortcut === true);
  }

  public parseSlashCommand(value: string): { value: string; nameWithSlash: string } {
    if (value.startsWith(SLASH_SYMBOL)) {
      const allSlashCommands = this.getAllSlashCommand();

      for (const command of allSlashCommands) {
        const { nameWithSlash } = command;
        if (value.startsWith(nameWithSlash)) {
          return {
            value: value.slice(nameWithSlash.length),
            nameWithSlash,
          };
        }
      }
    }

    return {
      value,
      nameWithSlash: '',
    };
  }
}
