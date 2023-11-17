import { Injectable, Autowired } from '@opensumi/di';
import { AiBackSerivcePath, IAiBackService } from '@opensumi/ide-ai-native';
import { Disposable } from '@opensumi/ide-core-common';

import { CompletionRequestBean } from '../model/competionModel';

@Injectable()
export class AiCompletionsService extends Disposable {
  @Autowired(AiBackSerivcePath)
  private readonly aiBackService: IAiBackService;

  public async complete(data: CompletionRequestBean) {
    return await this.aiBackService.requestCompletion(data as any);
  }
}
