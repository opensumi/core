import { Autowired, Injectable } from '@opensumi/di';
import { IAINativeCapabilities, IAINativeConfig, IAINativeInlineChatConfig } from '@opensumi/ide-core-common';

import { AILogoAvatar } from '../components/ai-native';
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

const DEFAULT_INLINE_CHAT_CONFIG: Required<IAINativeInlineChatConfig> = {
  inputWidth: 320,
  inputKeybinding: 'ctrlcmd+k',
  logo: AILogoAvatar,
};

@Injectable()
export class AINativeConfigService implements IAINativeConfig {
  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  @Autowired(LayoutViewSizeConfig)
  public layoutViewSize: LayoutViewSizeConfig;

  private aiModuleLoaded = false;

  private internalCapabilities = DEFAULT_CAPABILITIES;
  private internalInlineChat = DEFAULT_INLINE_CHAT_CONFIG;

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

  public get inlineChat(): Required<IAINativeInlineChatConfig> {
    const { AINativeConfig } = this.appConfig;

    if (AINativeConfig?.inlineChat) {
      return { ...this.internalInlineChat, ...AINativeConfig.inlineChat };
    }

    return this.internalInlineChat;
  }

  setAINativeModuleLoaded(value: boolean): void {
    this.aiModuleLoaded = value;
  }
}
