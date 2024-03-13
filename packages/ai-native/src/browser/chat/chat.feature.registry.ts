import { Injectable } from '@opensumi/di';
import { Disposable, getDebugLogger } from '@opensumi/ide-core-common';

import { IChatWelcomeMessageContent, ISampleQuestions } from '../../common';
import { IChatFeatureRegistry, IChatSlashCommandHandler, IChatSlashCommandItem } from '../types';

import { ChatSlashCommandItemModel, ChatWelcomeMessageModel } from './chat-model';

@Injectable()
export class ChatFeatureRegistry extends Disposable implements IChatFeatureRegistry {
  private readonly logger = getDebugLogger();
  private slashCommandsMap: Map<string, ChatSlashCommandItemModel> = new Map();
  private slashCommandsHandlerMap: Map<string, IChatSlashCommandHandler> = new Map();

  public chatWelcomeMessageModel: ChatWelcomeMessageModel;

  override dispose() {
    super.dispose();
    this.slashCommandsMap.clear();
    this.slashCommandsHandlerMap.clear();
  }

  registerWelcome(content: IChatWelcomeMessageContent, sampleQuestions: ISampleQuestions[]): void {
    this.chatWelcomeMessageModel = new ChatWelcomeMessageModel(content, sampleQuestions);
  }

  registerSlashCommand(command: IChatSlashCommandItem, handler: IChatSlashCommandHandler): void {
    const { name } = command;

    if (this.slashCommandsMap.has(name)) {
      this.logger.warn(`ChatFeatureRegistry: commands name ${name} already exists`);
      return;
    }

    this.slashCommandsMap.set(name, new ChatSlashCommandItemModel(command));
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
}
