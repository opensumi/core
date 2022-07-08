import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingWeight,
} from '@opensumi/ide-core-browser';
import { CommandContribution, CommandRegistry, Domain, ILogger } from '@opensumi/ide-core-common';

import { ICollaborationService } from '../common';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class CollaborationContribution implements ClientAppContribution, KeybindingContribution, CommandContribution {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(ICollaborationService)
  private collaborationService: ICollaborationService;

  onDidStart() {
    this.logger.log('Collaboration Contribution initialized');
    this.collaborationService.initialize();
  }

  onStop() {}

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: 'collaboration.undo',
      keybinding: 'ctrlcmd+z',
      when: 'editorFocus',
      priority: KeybindingWeight.EditorContrib,
    });

    keybindings.registerKeybinding({
      command: 'collaboration.redo',
      keybinding: 'shift+ctrlcmd+z',
      when: 'editorFocus',
      priority: KeybindingWeight.EditorContrib,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      {
        id: 'collaboration.undo',
        label: 'collaboration.undo',
      },
      {
        execute: () => {
          this.logger.log('Undo my change');
          this.collaborationService.undoOnCurrentBinding();
        },
      },
    );

    commands.registerCommand(
      {
        id: 'collaboration.redo',
        label: 'collaboration.redo',
      },
      {
        execute: () => {
          this.logger.log('Redo my change');
          this.collaborationService.redoOnCurrentBinding();
        },
      },
    );
  }
}
