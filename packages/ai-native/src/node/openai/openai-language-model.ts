import { OpenAIProvider, createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV1 } from 'ai';

import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, IAIBackServiceOption } from '@opensumi/ide-core-common';

import { ModelInfo, openAiNativeModels } from '../../common/model';
import { BaseLanguageModel } from '../base-language-model';

@Injectable()
export class OpenAIModel extends BaseLanguageModel {
  protected initializeProvider(options: IAIBackServiceOption): OpenAIProvider {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new Error(`Please provide OpenAI API Key in preferences (${AINativeSettingSectionsId.OpenaiApiKey})`);
    }
    return createOpenAI({
      apiKey,
    });
  }

  protected getModelIdentifier(provider: OpenAIProvider, modelId: string) {
    return provider(modelId) as LanguageModelV1;
  }

  protected getModelInfo(modelId: string): ModelInfo | undefined {
    return openAiNativeModels[modelId];
  }
}
