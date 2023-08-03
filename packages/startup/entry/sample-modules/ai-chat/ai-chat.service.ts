import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';

@Injectable()
export class AiChatService {
  private readonly _onChatMessageLaunch = new Emitter<string | React.ReactNode>();
  public readonly onChatMessageLaunch: Event<string | React.ReactNode> = this._onChatMessageLaunch.event;

  public launchChatMessage(message: string | React.ReactNode) {
    this._onChatMessageLaunch.fire(message);
  }
}
