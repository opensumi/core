import { Injectable } from '@opensumi/di';

import { AiRunHandler, IAiRunAnswerComponentProps, IAiRunFeatureRegistry, IAiBackService } from '../../common';

@Injectable()
export class AiRunFeatureRegistry implements IAiRunFeatureRegistry {
  private runs: AiRunHandler[] = [];
  private answerComponent?: React.FC<IAiRunAnswerComponentProps>;
  private request: IAiBackService['request'] | IAiBackService['requestStream'];

  registerRun(handler: AiRunHandler): void {
    this.runs.push(handler);
  }

  registerAnswerComponent(component: React.FC<IAiRunAnswerComponentProps>): void {
    this.answerComponent = component;
  }

  getRuns(): AiRunHandler[] {
    return this.runs;
  }

  getAnswerComponent(): React.FC<IAiRunAnswerComponentProps> | undefined {
    return this.answerComponent;
  }

  getRequest(): IAiBackService['request'] | IAiBackService['requestStream'] {
    return this.request;
  }
}
