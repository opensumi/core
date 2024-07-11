import { Autowired } from '@opensumi/di';
import { AINativeConfigService, ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { TerminalRegistryToken } from '@opensumi/ide-core-common';

import { AITerminalService } from './ai-terminal.service';
import { AITerminalDecorationService } from './decoration/terminal-decoration';
import { PS1TerminalService } from './ps1-terminal.service';
import { TerminalFeatureRegistry } from './terminal.feature.registry';

@Domain(ClientAppContribution)
export class TerminalAIContribution implements ClientAppContribution {
  @Autowired(AITerminalService)
  private readonly aiTerminalService: AITerminalService;

  @Autowired(AITerminalDecorationService)
  private readonly aiTerminalDecorationService: AITerminalDecorationService;

  @Autowired(PS1TerminalService)
  private readonly ps1TerminalService: PS1TerminalService;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(TerminalRegistryToken)
  private readonly terminalFeatureRegistry: TerminalFeatureRegistry;

  onDidStart() {
    if (this.aiNativeConfigService.capabilities.supportsTerminalDetection) {
      this.aiTerminalService.active();
      this.aiTerminalDecorationService.active();
    }
    if (
      this.aiNativeConfigService.capabilities.supportsTerminalCommandSuggest &&
      this.terminalFeatureRegistry.hasProvider()
    ) {
      this.ps1TerminalService.active();
    }
  }
}
