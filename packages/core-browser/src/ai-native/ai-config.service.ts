import { Autowired, Injectable } from '@opensumi/di';
import { IAINativeCapabilities, IAINativeLayout } from '@opensumi/ide-core-common';

import { LayoutViewSizeConfig } from '../layout/constants';
import { AppConfig } from '../react-providers/config-provider';

@Injectable({ multiple: false })
export class AINativeConfigService {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  @Autowired(LayoutViewSizeConfig)
  public layoutViewSize: LayoutViewSizeConfig;

  private internalCapabilities: Required<IAINativeCapabilities> = {
    supportsMarkers: false,
    supportsChatAssistant: false,
    supportsInlineChat: false,
    supportsInlineCompletion: false,
    supportsConflictResolve: false,
    supportsRenameSuggestions: false,
    supportsTerminalDetection: false,
    supportsTerminalCommandSuggest: false,
  };

  private internalLayout: Required<IAINativeLayout> = {
    useMergeRightWithLeftPanel: false,
    useMenubarView: false,
    menubarLogo: '',
  };

  private setDefaultCapabilities(value: boolean): void {
    for (const key in this.internalCapabilities) {
      if (this.internalCapabilities.hasOwnProperty(key)) {
        this.internalCapabilities[key] = value;
      }
    }
  }

  private setDefaultLayout(value: boolean): void {
    for (const key in this.internalLayout) {
      if (this.internalLayout.hasOwnProperty(key)) {
        this.internalLayout[key] = value;
      }
    }
  }

  public enableCapabilities(): void {
    this.setDefaultCapabilities(true);
  }

  public disableCapabilities(): void {
    this.setDefaultCapabilities(false);
  }

  public enableLayout(): void {
    this.setDefaultLayout(true);
  }

  public disableLayout(): void {
    this.setDefaultLayout(false);
  }

  public get capabilities(): Required<IAINativeCapabilities> {
    const { AINativeConfig } = this.appConfig;

    if (AINativeConfig?.capabilities) {
      return { ...this.internalCapabilities, ...AINativeConfig.capabilities };
    }

    return this.internalCapabilities;
  }

  public get layout(): Required<IAINativeLayout> {
    const { AINativeConfig } = this.appConfig;

    if (AINativeConfig?.layout) {
      return { ...this.internalLayout, ...AINativeConfig.layout };
    }

    return this.internalLayout;
  }
}
