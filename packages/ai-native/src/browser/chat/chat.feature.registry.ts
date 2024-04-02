import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { IChatWelcomeMessageContent, ISampleQuestions } from '../../common';

import { ChatWelcomeMessageModel } from './chat-model';

export interface IChatFeatureRegistry {
  registerWelcome(content: IChatWelcomeMessageContent | React.ReactNode, sampleQuestions?: ISampleQuestions[]): void;
}

@Injectable()
export class ChatFeatureRegistry extends Disposable implements IChatFeatureRegistry {
  public chatWelcomeMessageModel?: ChatWelcomeMessageModel;

  registerWelcome(content: IChatWelcomeMessageContent, sampleQuestions: ISampleQuestions[]): void {
    this.chatWelcomeMessageModel = new ChatWelcomeMessageModel(content, sampleQuestions);
  }
}
