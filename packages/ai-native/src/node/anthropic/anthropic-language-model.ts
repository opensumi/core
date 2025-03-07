import { AnthropicProvider, createAnthropic } from '@ai-sdk/anthropic';

import { Injectable } from '@opensumi/di';
import { IAIBackServiceOption } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { ModelInfo, anthropicModels } from '../../common/model';
import { BaseLanguageModel } from '../base-language-model';

export const AnthropicModelIdentifier = Symbol('AnthropicModelIdentifier');

@Injectable()
export class AnthropicModel extends BaseLanguageModel {
  protected initializeProvider(options: IAIBackServiceOption): AnthropicProvider {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new Error(`Please provide Anthropic API Key in preferences (${AINativeSettingSectionsId.AnthropicApiKey})`);
    }

    return createAnthropic({ apiKey });
  }

  protected getModelIdentifier(provider: AnthropicProvider, modelId = 'claude-3-5-sonnet-20241022') {
    return provider(modelId);
  }

  protected getModelInfo(modelId: string): ModelInfo | undefined {
    return anthropicModels[modelId];
  }
}
