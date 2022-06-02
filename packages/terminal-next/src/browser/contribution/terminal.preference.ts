import { Autowired } from '@opensumi/di';
import { PreferenceContribution, PreferenceSchemaProvider } from '@opensumi/ide-core-browser';
import { Domain, OperatingSystem, PreferenceSchema } from '@opensumi/ide-core-common';

import { ITerminalService } from '../../common';
import { CodeTerminalSettingId, terminalPreferenceSchema } from '../../common/preference';
import { NodePtyTerminalService } from '../terminal.service';

@Domain(PreferenceContribution)
export class TerminalPreferenceContribution implements PreferenceContribution {
  public schema: PreferenceSchema = terminalPreferenceSchema;

  @Autowired(ITerminalService)
  private ptyTerminal: NodePtyTerminalService;

  @Autowired(PreferenceSchemaProvider)
  private preferenceSchemaProvider: PreferenceSchemaProvider;

  constructor() {
    const TERMINAL_TYPE_ENUM = ['git-bash', 'powershell', 'cmd', 'default'];
    const {
      properties: { [CodeTerminalSettingId.TerminalType]: terminalTypeProperty },
    } = { ...terminalPreferenceSchema };

    this.ptyTerminal.getOS().then((osType) => {
      if (osType === OperatingSystem.Windows) {
        this.preferenceSchemaProvider.setSchema(
          {
            properties: {
              [CodeTerminalSettingId.TerminalType]: {
                ...terminalTypeProperty,
                enum: TERMINAL_TYPE_ENUM, // if OS is windows, update terminal type
              },
            },
          },
          true,
        );
      }
    });
  }
}
