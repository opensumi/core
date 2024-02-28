import { Autowired, Injectable } from '@opensumi/di';
import { IAiNativeCapabilities } from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers/config-provider';

@Injectable({ multiple: false })
export class AiNativeConfigService {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  private defaultCapabilities(value: boolean): Required<IAiNativeCapabilities> {
    return {
      supportsOpenSumiDesign: value,
      supportsAiMarkers: value,
      supportsAiChatAssistant: value,
      supportsInlineChat: value,
      supportsInlineCompletion: value,
      supportsConflictResolve: value,
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
