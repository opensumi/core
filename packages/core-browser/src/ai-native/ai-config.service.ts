import { Autowired, Injectable } from '@opensumi/di';
import {
  IAINativeCapabilities,
  IAINativeCodeEditsConfig,
  IAINativeConfig,
  IAINativeInlineChatConfig,
} from '@opensumi/ide-core-common';

import { AILogoAvatar } from '../components/ai-native';
import { LayoutViewSizeConfig } from '../layout/constants';
import { AppConfig } from '../react-providers/config-provider';

const DEFAULT_CAPABILITIES: Required<IAINativeCapabilities> = {
  supportsMarkers: true,
  supportsChatAssistant: true,
  supportsCodeAction: true,
  supportsInlineChat: true,
  supportsInlineCompletion: true,
  supportsConflictResolve: true,
  supportsRenameSuggestions: true,
  supportsProblemFix: true,
  supportsTerminalDetection: true,
  supportsTerminalCommandSuggest: true,
  supportsCustomLLMSettings: true,
  supportsMCP: true,
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

const DEFAULT_CODE_EDITS_CONFIG: Required<IAINativeCodeEditsConfig> = {
  triggerKeybinding: 'alt+\\',
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
  private internalCodeEdits = DEFAULT_CODE_EDITS_CONFIG;

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

  public get codeEdits(): Required<IAINativeCodeEditsConfig> {
    const { AINativeConfig } = this.appConfig;

    if (AINativeConfig?.codeEdits) {
      return { ...this.internalCodeEdits, ...AINativeConfig.codeEdits };
    }

    return this.internalCodeEdits;
  }

  setAINativeModuleLoaded(value: boolean): void {
    this.aiModuleLoaded = value;
  }
}
