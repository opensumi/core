import { OpenAICompatibleProvider, createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LanguageModelV1 } from 'ai';

import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, IAIBackServiceOption } from '@opensumi/ide-core-common';

import { BaseLanguageModel } from '../base-language-model';

export const DeepSeekModelIdentifier = Symbol('DeepSeekModelIdentifier');

@Injectable()
export class OpenAIModel extends BaseLanguageModel {
  protected initializeProvider(options: IAIBackServiceOption): OpenAICompatibleProvider {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new Error(`Please provide OpenAI API Key in preferences (${AINativeSettingSectionsId.OpenaiApiKey})`);
    }
    return createOpenAICompatible({
      apiKey,
      baseURL: options.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      name: 'openai',
    });
  }

  protected getModelIdentifier(provider: OpenAICompatibleProvider, modelId?: string): LanguageModelV1 {
    return provider(modelId || 'qwen-max');
  }
}
