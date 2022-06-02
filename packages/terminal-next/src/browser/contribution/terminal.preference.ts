import { Autowired } from '@opensumi/di';
import { PreferenceContribution } from '@opensumi/ide-core-browser';
import { Domain, OperatingSystem, PreferenceSchema } from '@opensumi/ide-core-common';

import { ITerminalService } from '../../common';
import { terminalPreferenceSchema } from '../../common/preference';
import { NodePtyTerminalService } from '../terminal.service';

@Domain(PreferenceContribution)
export class TerminalPreferenceContribution implements PreferenceContribution {
  public schema: PreferenceSchema;

  @Autowired(ITerminalService)
  private client: NodePtyTerminalService;

  constructor() {
    this.schema = terminalPreferenceSchema;
    this.client.getOS().then((osType) => {
      switch (osType) {
        case OperatingSystem.Windows:
          terminalPreferenceSchema.properties['terminal.type'].enum = ['git-bash', 'powershell', 'cmd', 'default'];
          break;
        default:
          terminalPreferenceSchema.properties['terminal.type'].enum = ['zsh', 'bash', 'sh', 'default'];
      }
    });
  }
}
