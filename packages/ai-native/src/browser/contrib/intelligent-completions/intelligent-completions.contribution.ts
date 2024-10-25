import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  Key,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
} from '@opensumi/ide-core-browser';
import {
  AI_MULTI_LINE_COMPLETION_ACCEPT,
  AI_MULTI_LINE_COMPLETION_DISCARD,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import { MultiLineEditsIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { CommandContribution, CommandRegistry, Domain } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import { IntelligentCompletionsController } from './intelligent-completions.controller';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class IntelligentCompletionsContribution implements KeybindingContribution, CommandContribution {
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorServiceImpl;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(AI_MULTI_LINE_COMPLETION_DISCARD, {
      execute: () => {
        const editor = this.workbenchEditorService.currentCodeEditor;
        if (editor) {
          IntelligentCompletionsController.get(editor.monacoEditor)?.discard.get();
        }
      },
    });

    commands.registerCommand(AI_MULTI_LINE_COMPLETION_ACCEPT, {
      execute: () => {
        const editor = this.workbenchEditorService.currentCodeEditor;
        if (editor) {
          IntelligentCompletionsController.get(editor.monacoEditor)?.accept.get();
        }
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: AI_MULTI_LINE_COMPLETION_DISCARD.id,
      keybinding: Key.ESCAPE.code,
      when: MultiLineEditsIsVisible.raw,
      priority: 100,
    });

    keybindings.registerKeybinding(
      {
        command: AI_MULTI_LINE_COMPLETION_ACCEPT.id,
        keybinding: Key.TAB.code,
        when: MultiLineEditsIsVisible.raw,
      },
      KeybindingScope.USER,
    );
  }
}
