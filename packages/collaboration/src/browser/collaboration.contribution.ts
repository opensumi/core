import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingWeight,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { CommandContribution, CommandRegistry, Domain, ILogger, PreferenceScope } from '@opensumi/ide-core-common';

import { ICollaborationService } from '../common';
import { REDO, UNDO } from '../common/commands';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class CollaborationContribution implements ClientAppContribution, KeybindingContribution, CommandContribution {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(ICollaborationService)
  private collaborationService: ICollaborationService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  onDidStart() {
    this.logger.log('Collaboration Contribution initialized');
    this.logger.log('preference got', this.preferenceService.get('editor.askIfDiff'));
    if (this.preferenceService.get('editor.askIfDiff') === true) {
      this.logger.log('Set ask diff to false');
      this.preferenceService.set('editor.askIfDiff', false);
    }
    this.collaborationService.initialize();
  }

  onStop() {
    if (this.preferenceService.get('editor.askIfDiff') === false) {
      this.logger.log('Set ask diff to true');
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
        this.collaborationService.undoOnCurrentBinding();
      },
    });

    commands.registerCommand(REDO, {
      execute: () => {
        this.collaborationService.redoOnCurrentBinding();
      },
    });
  }
}
