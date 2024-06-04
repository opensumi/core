import { Autowired, Injectable } from '@opensumi/di';
import { IAINativeCapabilities } from '@opensumi/ide-core-common';

import { LayoutViewSizeConfig } from '../layout/constants';
import { AppConfig } from '../react-providers/config-provider';

@Injectable()
export class AINativeConfigService {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  @Autowired(LayoutViewSizeConfig)
  public layoutViewSize: LayoutViewSizeConfig;

  private internalCapabilities: Required<IAINativeCapabilities> = {
    supportsMarkers: true,
    supportsChatAssistant: true,
    supportsInlineChat: true,
    supportsInlineCompletion: true,
    supportsConflictResolve: true,
    supportsRenameSuggestions: true,
    supportsTerminalDetection: true,
    supportsTerminalCommandSuggest: true,
  };

  private setDefaultCapabilities(value: boolean): void {
    for (const key in this.internalCapabilities) {
      if (Object.prototype.hasOwnProperty.call(this.internalCapabilities, key)) {
        this.internalCapabilities[key] = value;
      }
    }
  }

  public enableCapabilities(): void {
    this.setDefaultCapabilities(true);
  }

  public disableCapabilities(): void {
    this.setDefaultCapabilities(false);
  }

  public get capabilities(): Required<IAINativeCapabilities> {
    const { AINativeConfig } = this.appConfig;

    if (AINativeConfig?.capabilities) {
      return { ...this.internalCapabilities, ...AINativeConfig.capabilities };
    }

    return this.internalCapabilities;
  }
}
