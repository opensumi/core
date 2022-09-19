import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingWeight,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { CommandContribution, CommandRegistry, ContributionProvider, Domain } from '@opensumi/ide-core-common';
import { AUTO_SAVE_MODE } from '@opensumi/ide-editor';

import { ICollaborationService, CollaborationModuleContribution } from '../common';
import { REDO, UNDO } from '../common/commands';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class CollaborationContribution implements ClientAppContribution, KeybindingContribution, CommandContribution {
  @Autowired(ICollaborationService)
  private collaborationService: ICollaborationService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(CollaborationModuleContribution)
  private readonly contributionProvider: ContributionProvider<CollaborationModuleContribution>;

  private prevSetAskIfDiff: boolean;
  private prevSetAutoChange: string;

  onDidStart() {
    if (this.preferenceService.get('editor.askIfDiff') === true) {
      this.prevSetAskIfDiff = true;
      this.preferenceService.set('editor.askIfDiff', false);
    }

    if (this.preferenceService.get('editor.autoSave') !== AUTO_SAVE_MODE.AFTER_DELAY) {
      this.prevSetAutoChange = this.preferenceService.get('editor.autoSave') as string;
      this.preferenceService.set('editor.autoSave', AUTO_SAVE_MODE.AFTER_DELAY);
    }

    // before init
    const providers = this.contributionProvider.getContributions();
    for (const provider of providers) {
      this.collaborationService.registerContribution(provider);
    }

    this.collaborationService.initialize();
  }

  onStop() {
    if (this.prevSetAskIfDiff !== undefined) {
      this.preferenceService.set('editor.askIfDiff', this.prevSetAskIfDiff);
    }

    if (this.prevSetAutoChange !== undefined) {
      this.preferenceService.set('editor.autoSave', this.prevSetAutoChange);
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
        this.collaborationService.undoOnFocusedTextModel();
      },
    });

    commands.registerCommand(REDO, {
      execute: () => {
        this.collaborationService.redoOnFocusedTextModel();
      },
    });
  }
}
