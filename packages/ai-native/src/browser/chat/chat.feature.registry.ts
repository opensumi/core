import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { IChatWelcomeMessageContent, ISampleQuestions } from '../../common';
import { IChatFeatureRegistry } from '../types';

import { ChatWelcomeMessageModel } from './chat-model';

@Injectable()
export class ChatFeatureRegistry extends Disposable implements IChatFeatureRegistry {
  public chatWelcomeMessageModel: ChatWelcomeMessageModel;

  registerWelcome(content: IChatWelcomeMessageContent, sampleQuestions: ISampleQuestions[]): void {
    this.chatWelcomeMessageModel = new ChatWelcomeMessageModel(content, sampleQuestions);
  }
}
