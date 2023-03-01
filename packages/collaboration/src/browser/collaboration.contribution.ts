import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  FsProviderContribution,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingWeight,
} from '@opensumi/ide-core-browser';
import { CommandContribution, CommandRegistry, ContributionProvider, Domain } from '@opensumi/ide-core-common';

import { ICollaborationService, CollaborationModuleContribution } from '../common';
import { REDO, UNDO } from '../common/commands';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution, FsProviderContribution)
export class CollaborationContribution
  implements ClientAppContribution, KeybindingContribution, CommandContribution, FsProviderContribution
{
  @Autowired(ICollaborationService)
  private collaborationService: ICollaborationService;

  @Autowired(CollaborationModuleContribution)
  private readonly contributionProvider: ContributionProvider<CollaborationModuleContribution>;

  initialize() {
    this.collaborationService.initialize();
  }

  onDidStart() {
    const providers = this.contributionProvider.getContributions();
    for (const provider of providers) {
      this.collaborationService.registerContribution(provider);
    }

    this.collaborationService.registerUserInfo();
  }

  onStop() {
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
        this.collaborationService.undoOnFocusedTextModel();
      },
    });

    commands.registerCommand(REDO, {
      execute: () => {
        this.collaborationService.redoOnFocusedTextModel();
      },
    });
  }

  onFileServiceReady() {
    this.collaborationService.initFileWatch();
  }
}
