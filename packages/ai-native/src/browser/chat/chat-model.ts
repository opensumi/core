import { Disposable } from '@opensumi/ide-core-common';

import { IChatWelcomeMessageContent, ISampleQuestions } from '../../common';

export class ChatWelcomeMessageModel extends Disposable {
  private static nextId = 0;

  private _id: string;
  public get id(): string {
    return this._id;
  }

  constructor(
    public readonly content: IChatWelcomeMessageContent,
    public readonly sampleQuestions: ISampleQuestions[],
  ) {
    super();

    this._id = 'welcome_' + ChatWelcomeMessageModel.nextId++;
  }
}
