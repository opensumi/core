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
    // 如果没有启用终端能力
    if (!this.aiNativeConfigService.capabilities.supportsAITerminal) {
      return;
    }
    this.aiTerminalService.active();
    this.aiTerminalDecorationService.active();
    this.ps1TerminalService.active();
  }
}
