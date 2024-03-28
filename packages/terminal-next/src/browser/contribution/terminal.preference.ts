import { Autowired } from '@opensumi/di';
import { ClientAppContribution, PreferenceContribution, PreferenceSchemaProvider } from '@opensumi/ide-core-browser';
import { Domain, OperatingSystem, PreferenceSchema, TerminalSettingsId } from '@opensumi/ide-core-common';

import { ITerminalService } from '../../common';
import { terminalPreferenceSchema } from '../../common/preference';
import { NodePtyTerminalService } from '../terminal.service';

@Domain(PreferenceContribution, ClientAppContribution)
export class TerminalPreferenceContribution implements PreferenceContribution, ClientAppContribution {
  public schema: PreferenceSchema = terminalPreferenceSchema;

  @Autowired(ITerminalService)
  private ptyTerminal: NodePtyTerminalService;

  @Autowired(PreferenceSchemaProvider)
  private preferenceSchemaProvider: PreferenceSchemaProvider;

  async initialize(): Promise<void> {
    const TERMINAL_TYPE_ENUM = ['git-bash', 'powershell', 'cmd', 'default'];
    const {
      properties: { [TerminalSettingsId.Type]: terminalTypeProperty },
    } = { ...terminalPreferenceSchema };

    const osType = await this.ptyTerminal.getOS();
    if (osType === OperatingSystem.Windows) {
      this.preferenceSchemaProvider.setSchema(
        {
          properties: {
            [TerminalSettingsId.Type]: {
              ...terminalTypeProperty,
              enum: TERMINAL_TYPE_ENUM, // if OS is windows, update terminal type
            },
          },
        },
        true,
      );
    }
  }
}
