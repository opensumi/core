import { DeepSeekProvider, createDeepSeek } from '@ai-sdk/deepseek';

import { Injectable } from '@opensumi/di';
import { IAIBackServiceOption } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { BaseLanguageModel } from '../base-language-model';

export const DeepSeekModelIdentifier = Symbol('DeepSeekModelIdentifier');

@Injectable()
export class DeepSeekModel extends BaseLanguageModel {
  protected initializeProvider(options: IAIBackServiceOption): DeepSeekProvider {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new Error(`Please provide Deepseek API Key in preferences (${AINativeSettingSectionsId.DeepseekApiKey})`);
    }

    return createDeepSeek({ apiKey });
  }

  protected getModelIdentifier(provider: DeepSeekProvider) {
    return provider('deepseek-chat');
  }
}
