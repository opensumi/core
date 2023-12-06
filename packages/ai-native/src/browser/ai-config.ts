import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { IAiNativeCapabilities } from '@opensumi/ide-core-common';

@Injectable({ multiple: false })
export class AiNativeConfig {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  private defaultCapabilities(value: boolean): Required<IAiNativeCapabilities> {
    return {
      supportsOpenSumiDesign: value,
      supportsAiMarkers: value,
      supportsAiChatAssistant: value,
      supportsInlineChat: value,
      supportsInlineCompletion: value,
    };
  }

  public get capabilities(): Required<IAiNativeCapabilities> {
    const { aiNativeConfig } = this.appConfig;

    if (!aiNativeConfig) {
      return this.defaultCapabilities(true);
    }

    const { capabilities } = aiNativeConfig;
    if (!capabilities) {
      return this.defaultCapabilities(true);
    }

    return { ...this.defaultCapabilities(false), ...capabilities };
  }
}
