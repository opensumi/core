import { OpenAIProvider, createOpenAI } from '@ai-sdk/openai';

import { Injectable } from '@opensumi/di';
import { BaseLanguageModel } from '@opensumi/ide-ai-native/lib/node/base-language-model';
import { AINativeSettingSectionsId, IAIBackServiceOption } from '@opensumi/ide-core-common';

export const DeepSeekModelIdentifier = Symbol('DeepSeekModelIdentifier');

@Injectable()
export class OpenAIModel extends BaseLanguageModel {
  protected initializeProvider(options: IAIBackServiceOption): OpenAIProvider {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new Error(`Please provide OpenAI API Key in preferences (${AINativeSettingSectionsId.OpenaiApiKey})`);
    }
    return createOpenAI({
      apiKey,
      baseURL: options.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
  }

  protected getModelIdentifier(provider: OpenAIProvider) {
    return provider('qwen-max');
  }
}
