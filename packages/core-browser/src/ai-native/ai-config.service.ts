import { Autowired, Injectable } from '@opensumi/di';
import { IAINativeCapabilities } from '@opensumi/ide-core-common';

import { LayoutViewSizeConfig } from '../layout/constants';
import { AppConfig } from '../react-providers/config-provider';

const DEFAULT_CAPABILITIES: Required<IAINativeCapabilities> = {
  supportsMarkers: true,
  supportsChatAssistant: true,
  supportsInlineChat: true,
  supportsInlineCompletion: true,
  supportsConflictResolve: true,
  supportsRenameSuggestions: true,
  supportsProblemFix: true,
  supportsTerminalDetection: true,
  supportsTerminalCommandSuggest: true,
};

const DISABLED_ALL_CAPABILITIES = {} as Required<IAINativeCapabilities>;
Object.keys(DEFAULT_CAPABILITIES).forEach((key) => {
  DISABLED_ALL_CAPABILITIES[key] = false;
});

@Injectable()
export class AINativeConfigService {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  @Autowired(LayoutViewSizeConfig)
  public layoutViewSize: LayoutViewSizeConfig;

  private aiModuleLoaded = false;

  private internalCapabilities = DEFAULT_CAPABILITIES;

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
    if (!this.aiModuleLoaded) {
      return DISABLED_ALL_CAPABILITIES;
    }

    const { AINativeConfig } = this.appConfig;

    if (AINativeConfig?.capabilities) {
      return { ...this.internalCapabilities, ...AINativeConfig.capabilities };
    }

    return this.internalCapabilities;
  }

  setAINativeModuleLoaded(value: boolean): void {
    this.aiModuleLoaded = value;
  }
}
