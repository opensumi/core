import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { AISerivceType } from '@opensumi/ide-startup/lib/common/index';

const aiSearchKey = '/search ';
const aiSearchCodeKey = '/searchcode ';
const aiSumiKey = '/sumi';

@Injectable()
export class AiChatService {
  private readonly _onChatMessageLaunch = new Emitter<string | React.ReactNode>();
  public readonly onChatMessageLaunch: Event<string | React.ReactNode> = this._onChatMessageLaunch.event;

  public launchChatMessage(message: string | React.ReactNode) {
    this._onChatMessageLaunch.fire(message);
  }

  public switchAIService(input: string) {
    let type: AISerivceType | undefined;
    let message: string | undefined;

    if (input.startsWith(aiSearchKey)) {
      type = AISerivceType.Search;
      message = input.split(aiSearchKey)[1];
    } else if (input.startsWith(aiSearchCodeKey)) {
      type = AISerivceType.SearchCode;
      message = input.split(aiSearchCodeKey)[1];
    } else if (input.startsWith(aiSumiKey)) {
      type = AISerivceType.Sumi;
      message = input.split(aiSumiKey)[1];
    }

    return { type, message };
  }
}
