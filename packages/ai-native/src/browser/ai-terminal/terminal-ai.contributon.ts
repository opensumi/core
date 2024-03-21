import { Autowired } from '@opensumi/di';
import { AINativeConfigService, ClientAppContribution, Domain } from '@opensumi/ide-core-browser';

import { AITerminalService } from './ai-terminal.service';
import { AITerminalDecorationService } from './decoration/terminal-decoration';
import { PS1TerminalService } from './ps1-terminal.service';

@Domain(ClientAppContribution)
export class TerminalAIContribution implements ClientAppContribution {
  @Autowired(AITerminalService)
  aiTerminalService: AITerminalService;

  @Autowired(AITerminalDecorationService)
  aiTerminalDecorationService: AITerminalDecorationService;

  @Autowired(PS1TerminalService)
  ps1TerminalService: PS1TerminalService;

  @Autowired(AINativeConfigService)
  aiNativeConfigService: AINativeConfigService;

  onDidStart() {
    if (this.aiNativeConfigService.capabilities.supportsTerminalDetection) {
      this.aiTerminalService.active();
      this.aiTerminalDecorationService.active();
    }
    if (this.aiNativeConfigService.capabilities.supportsTerminalCommandSuggest) {
      this.ps1TerminalService.active();
    }
  }
}
