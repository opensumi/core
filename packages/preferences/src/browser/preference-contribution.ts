import { Autowired } from '@ali/common-di';

import {
  ClientAppContribution,
  Command,
  Domain,
  CommandContribution,
  CommandRegistry,
  COMMON_COMMANDS,
  KeybindingContribution,
  KeybindingRegistry,
  PreferenceScope,
} from '@ali/ide-core-browser';

@Domain(CommandContribution, KeybindingContribution)
export class PreferenceContribution implements CommandContribution, KeybindingContribution {

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(COMMON_COMMANDS.OPEN_PREFERENCES, {
        isEnabled: () => true,
        execute: (preferenceScope = PreferenceScope.User) => {
          // this.openPreferences(preferenceScope)
        },

    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
        command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
        keybinding: 'ctrl+,',
    });
  }
}
