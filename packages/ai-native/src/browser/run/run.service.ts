import { Injectable, Autowired } from '@opensumi/di';
import { CancellationToken } from '@opensumi/ide-core-common';

import { IAiRunAnswerComponentProps, IAiRunFeatureRegistry } from '../../common';

import { AiRunFeatureRegistry } from './run.feature.registry';

@Injectable()
export class AiRunService {
  @Autowired(IAiRunFeatureRegistry)
  private readonly aiRunFeatureRegistry: AiRunFeatureRegistry;

  public async run() {
    const runs = this.aiRunFeatureRegistry.getRuns();
    for (const run of runs) {
      await run();
    }
  }

  public answerComponentRender(): React.FC<IAiRunAnswerComponentProps> | undefined {
    return this.aiRunFeatureRegistry.getAnswerComponent();
  }

  public async requestBackService(input: string, cancelToken: CancellationToken) {
    const request = this.aiRunFeatureRegistry.getRequest();
    return request(input, { cancelToken });
  }

  public async requestStreamBackService(input: string, cancelToken: CancellationToken) {
    const request = this.aiRunFeatureRegistry.getStreamRequest();
    return request(input, { cancelToken });
  }
}
