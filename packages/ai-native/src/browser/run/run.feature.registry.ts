import { Injectable } from '@opensumi/di';

import { AiRunHandler, IAiRunAnswerComponentProps, IAiRunFeatureRegistry } from '../../common';

@Injectable()
export class AiRunFeatureRegistry implements IAiRunFeatureRegistry {
  private runs: AiRunHandler[] = [];
  private answerComponent?: React.FC<IAiRunAnswerComponentProps>;

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
}
