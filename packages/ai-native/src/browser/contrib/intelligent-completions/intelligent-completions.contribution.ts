import { Autowired } from '@opensumi/di';
import {
  AINativeConfigService,
  ClientAppContribution,
  Key,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
} from '@opensumi/ide-core-browser';
import { AI_CODE_EDITS_COMMANDS } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { CodeEditsIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { CommandContribution, CommandRegistry, Domain } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { transaction } from '@opensumi/ide-monaco/lib/common/observable';

import { IntelligentCompletionsController } from './intelligent-completions.controller';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class IntelligentCompletionsContribution implements KeybindingContribution, CommandContribution {
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(AI_CODE_EDITS_COMMANDS.DISCARD, {
      execute: () => {
        const editor = this.workbenchEditorService.currentCodeEditor;
        if (editor) {
          IntelligentCompletionsController.get(editor.monacoEditor)?.discard.get();
        }
      },
    });

    commands.registerCommand(AI_CODE_EDITS_COMMANDS.ACCEPT, {
      execute: () => {
        const editor = this.workbenchEditorService.currentCodeEditor;
        if (editor) {
          IntelligentCompletionsController.get(editor.monacoEditor)?.accept.get();
        }
      },
    });

    commands.registerCommand(AI_CODE_EDITS_COMMANDS.TRIGGER, {
      execute: () => {
        const editor = this.workbenchEditorService.currentCodeEditor;
        if (editor) {
          transaction((tx) => {
            IntelligentCompletionsController.get(editor.monacoEditor)?.trigger(tx);
          });
        }
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    const { codeEdits } = this.aiNativeConfigService;

    keybindings.registerKeybinding({
      command: AI_CODE_EDITS_COMMANDS.DISCARD.id,
      keybinding: Key.ESCAPE.code,
      when: CodeEditsIsVisible.raw,
      priority: 100,
    });

    keybindings.registerKeybinding(
      {
        command: AI_CODE_EDITS_COMMANDS.ACCEPT.id,
        keybinding: Key.TAB.code,
        when: CodeEditsIsVisible.raw,
      },
      KeybindingScope.USER,
    );

    keybindings.registerKeybinding(
      {
        command: AI_CODE_EDITS_COMMANDS.TRIGGER.id,
        keybinding: codeEdits.triggerKeybinding,
        when: 'editorFocus',
      },
      KeybindingScope.USER,
    );
  }
}
