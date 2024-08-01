import { Autowired } from '@opensumi/di';
import { Key } from '@opensumi/ide-core-browser';
import {
  ClientAppContribution,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
} from '@opensumi/ide-core-browser';
import {
  AI_MULTI_LINE_COMPLETION_ACCEPT,
  AI_MULTI_LINE_COMPLETION_HIDE,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import { MultiLineCompletionsIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { CommandContribution, CommandRegistry, Domain } from '@opensumi/ide-core-common';

import { IntelligentCompletionsHandler } from './intelligent-completions.handler';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class IntelligentCompletionsContribution implements KeybindingContribution, CommandContribution {
  @Autowired(IntelligentCompletionsHandler)
  private readonly intelligentCompletionsHandler: IntelligentCompletionsHandler;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(AI_MULTI_LINE_COMPLETION_HIDE, {
      execute: () => {
        this.intelligentCompletionsHandler.hide();
      },
    });

    commands.registerCommand(AI_MULTI_LINE_COMPLETION_ACCEPT, {
      execute: () => {
        this.intelligentCompletionsHandler.accept();
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: AI_MULTI_LINE_COMPLETION_HIDE.id,
      keybinding: Key.ESCAPE.code,
      when: MultiLineCompletionsIsVisible.raw,
      priority: 100,
    });

    keybindings.registerKeybinding(
      {
        command: AI_MULTI_LINE_COMPLETION_ACCEPT.id,
        keybinding: Key.TAB.code,
        when: MultiLineCompletionsIsVisible.raw,
      },
      KeybindingScope.USER,
    );
  }
}
