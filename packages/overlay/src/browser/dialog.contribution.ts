import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  DIALOG_COMMANDS,
  Domain,
  KeybindingContribution,
  KeybindingRegistry,
  localize,
} from '@opensumi/ide-core-browser';
import { DialogViewVisibleContext } from '@opensumi/ide-core-browser/lib/contextkey/dialog';

import { IDialogService } from '../common';

@Domain(CommandContribution, KeybindingContribution)
export class DialogContribution implements CommandContribution, KeybindingContribution {
  @Autowired(IDialogService)
  private dialogService: IDialogService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(
      {
        id: DIALOG_COMMANDS.ENSURE.id,
        label: localize('dialog.ensure'),
      },
      {
        execute: () => {
          const buttons = this.dialogService.getButtons();
          if (buttons && buttons.length > 0) {
            // 默认使用最后一个选项作为返回值
            this.dialogService.hide(buttons?.[buttons.length - 1]);
          }
        },
      },
    );

    registry.registerCommand(
      {
        id: DIALOG_COMMANDS.OPEN.id,
      },
      {
        execute: (args: { message: string; type: number; buttons?: string[]; closable?: boolean }) =>
          this.dialogService.open<string>({
            message: args.message,
            type: args.type,
            buttons: args.buttons,
            closable: args.closable,
          }),
      },
    );
  }

  registerKeybindings(bindings: KeybindingRegistry) {
    bindings.registerKeybinding({
      command: DIALOG_COMMANDS.ENSURE.id,
      keybinding: 'enter',
      when: `${DialogViewVisibleContext.raw}`,
    });
  }
}
