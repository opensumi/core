import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingWeight,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { CommandContribution, CommandRegistry, Domain } from '@opensumi/ide-core-common';

import { ICollaborationService } from '../common';
import { REDO, UNDO } from '../common/commands';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class CollaborationContribution implements ClientAppContribution, KeybindingContribution, CommandContribution {
  @Autowired(ICollaborationService)
  private collaborationService: ICollaborationService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  onDidStart() {
    if (this.preferenceService.get('editor.askIfDiff') === true) {
      this.preferenceService.set('editor.askIfDiff', false);
    }
    this.collaborationService.initialize();
  }

  onStop() {
    if (this.preferenceService.get('editor.askIfDiff') === false) {
      this.preferenceService.set('editor.askIfDiff', true);
    }
    this.collaborationService.destroy();
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: UNDO.id,
      keybinding: 'ctrlcmd+z',
      when: 'editorFocus',
      priority: KeybindingWeight.EditorContrib,
    });

    keybindings.registerKeybinding({
      command: REDO.id,
      keybinding: 'shift+ctrlcmd+z',
      when: 'editorFocus',
      priority: KeybindingWeight.EditorContrib,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(UNDO, {
      execute: () => {
        this.collaborationService.undoOnCurrentResource();
      },
    });

    commands.registerCommand(REDO, {
      execute: () => {
        this.collaborationService.redoOnCurrentResource();
      },
    });
  }
}
