export interface ModelInfo {
  maxTokens?: number;
  contextWindow?: number;
  supportsImages?: boolean;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export const deepSeekModels = {
  'deepseek-chat': {
    maxTokens: 8_000,
    contextWindow: 64_000,
    supportsImages: false,
  },
  'deepseek-reasoner': {
    maxTokens: 8_000,
    contextWindow: 64_000,
    supportsImages: false,
    temperature: 0.7,
    topP: 0.95,
  },
} as Record<string, ModelInfo>;

export const anthropicModels = {
  'claude-3-7-sonnet-20250219': {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
  },
  'claude-3-5-sonnet-20241022': {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
  },
  'claude-3-5-haiku-20241022': {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: false,
  },
  'claude-3-opus-20240229': {
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
  },
  'claude-3-haiku-20240307': {
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
  },
} as Record<string, ModelInfo>; // as const assertion makes the object deeply readonly

export const openAiNativeModels = {
  'o3-mini': {
    maxTokens: 100_000,
    contextWindow: 200_000,
    supportsImages: false,
  },
  // don't support tool use yet
  o1: {
    maxTokens: 100_000,
    contextWindow: 200_000,
    supportsImages: true,
  },
  'o1-preview': {
    maxTokens: 32_768,
    contextWindow: 128_000,
    supportsImages: true,
  },
  'o1-mini': {
    maxTokens: 65_536,
    contextWindow: 128_000,
    supportsImages: true,
  },
  'gpt-4o': {
    maxTokens: 4_096,
    contextWindow: 128_000,
    supportsImages: true,
  },
  'gpt-4o-mini': {
    maxTokens: 16_384,
    contextWindow: 128_000,
    supportsImages: true,
  },
  'gpt-4.5-preview': {
    maxTokens: 16_384,
    contextWindow: 128_000,
    supportsImages: true,
  },
} as Record<string, ModelInfo>;
