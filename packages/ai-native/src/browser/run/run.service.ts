import { Injectable, Autowired } from '@opensumi/di';
import { CancellationToken } from '@opensumi/ide-core-common';

import { IAIReporter, AISerivceType } from '../../common';
import { IAiRunAnswerComponentProps, IAiRunFeatureRegistry } from '../types';

import { AiRunFeatureRegistry } from './run.feature.registry';

@Injectable()
export class AiRunService {
  @Autowired(IAiRunFeatureRegistry)
  private readonly aiRunFeatureRegistry: AiRunFeatureRegistry;

  @Autowired(IAIReporter)
  private readonly aiRepoter: IAIReporter;

  public async run() {
    const runs = this.aiRunFeatureRegistry.getRuns();
    let success = true;
    const startTime = +new Date();
    const relationId = this.aiRepoter.start(AISerivceType.Run, { message: 'Start run' });
    try {
      for (const run of runs) {
        await run();
      }
    } catch {
      success = false;
    }
    this.aiRepoter.end(relationId, {
      replytime: +new Date() - startTime,
      success,
      message: 'Finished run',
      runSuccess: success,
    });
  }

  public answerComponentRender(): React.FC<IAiRunAnswerComponentProps> | undefined {
    return this.aiRunFeatureRegistry.getAnswerComponent();
  }

  public async requestBackService(input: string, cancelToken: CancellationToken) {
    const request = this.aiRunFeatureRegistry.getRequest();
    return request(input, { type: 'run' }, cancelToken);
  }

  public async requestStreamBackService(input: string, cancelToken: CancellationToken) {
    const request = this.aiRunFeatureRegistry.getStreamRequest();
    return request(input, { type: 'run' }, cancelToken);
  }
}
