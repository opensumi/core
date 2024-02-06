import { Injectable, Autowired } from '@opensumi/di';
import { IAiNativeCapabilities } from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers/config-provider';

@Injectable({ multiple: false })
export class AiNativeConfigService {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  private config: Required<IAiNativeCapabilities> = {
    supportsOpenSumiDesign: false,
    supportsAiMarkers: false,
    supportsAiChatAssistant: false,
    supportsInlineChat: false,
    supportsInlineCompletion: false,
    supportsConflictResolve: false,
  };

  private setDefaultCapabilities(value: boolean): void {
    for (let key in this.config) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = value;
      }
    }
  }

  public enable(): void {
    this.setDefaultCapabilities(true);
  }

  public disable(): void {
    this.setDefaultCapabilities(false);
  }

  public get capabilities(): Required<IAiNativeCapabilities> {
    const { aiNativeConfig } = this.appConfig;

    if (aiNativeConfig?.capabilities) {
      return { ...this.config, ...aiNativeConfig.capabilities };
    }

    return this.config;
  }
}
