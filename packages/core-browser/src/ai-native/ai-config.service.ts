import { Autowired, Injectable } from '@opensumi/di';
import { IAINativeCapabilities } from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers/config-provider';

@Injectable({ multiple: false })
export class AINativeConfigService {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  private config: Required<IAINativeCapabilities> = {
    supportsOpenSumiDesign: false,
    supportsMarkers: false,
    supportsChatAssistant: false,
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

  public get capabilities(): Required<IAINativeCapabilities> {
    const { AINativeConfig } = this.appConfig;

    if (AINativeConfig?.capabilities) {
      return { ...this.config, ...AINativeConfig.capabilities };
    }

    return this.config;
  }
}
