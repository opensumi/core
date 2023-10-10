import { KeybindingContribution, KeybindingRegistry, TERMINAL_COMMANDS } from '@opensumi/ide-core-browser';
import { IsTerminalFocused } from '@opensumi/ide-core-browser/lib/contextkey';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';
import { Domain, isWindows } from '@opensumi/ide-core-common';

@Domain(KeybindingContribution)
export class TerminalKeybindingContribution implements KeybindingContribution {
  registerKeybindings(registry: KeybindingRegistry) {
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.OPEN_SEARCH.id,
      keybinding: 'ctrlcmd+f',
      when: IsTerminalFocused.raw,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.CLEAR_CONTENT.id,
      keybinding: 'ctrlcmd+k',
      when: IsTerminalFocused.raw,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.SEARCH_NEXT.id,
      keybinding: 'ctrlcmd+g',
      when: IsTerminalFocused.raw,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.COPY.id,
      keybinding: isWindows ? 'ctrlcmd+shift+c' : 'ctrlcmd+c',
      // http 协议无法访问 navigator.clipboard，使用 xterm 原生快捷键
      when: RawContextKey.and(IsTerminalFocused.raw, 'locationProtocol != http'),
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.KILL_PROCESS.id,
      keybinding: 'ctrlcmd+c',
      when: RawContextKey.and(IsTerminalFocused.raw, 'locationProtocol != http', 'isWindows'),
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.PASTE.id,
      keybinding: isWindows ? 'ctrlcmd+shift+v' : 'ctrlcmd+v',
      // http 协议无法访问 navigator.clipboard，使用 xterm 原生快捷键
      when: RawContextKey.and(IsTerminalFocused.raw, 'locationProtocol != http'),
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.SELECT_ALL.id,
      keybinding: 'ctrlcmd+a',
      when: IsTerminalFocused.raw,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.SPLIT.id,
      keybinding: 'ctrlcmd+\\',
      when: IsTerminalFocused.raw,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.ADD.id,
      keybinding: 'ctrl+shift+`',
    });

    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.FOCUS_NEXT_TERMINAL.id,
      keybinding: 'ctrlcmd+alt+right',
      when: IsTerminalFocused.raw,
    });

    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.FOCUS_NEXT_TERMINAL.id,
      keybinding: 'ctrlcmd+alt+down',
      when: IsTerminalFocused.raw,
    });

    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.FOCUS_PREVIOUS_TERMINAL.id,
      keybinding: 'ctrlcmd+alt+left',
      when: IsTerminalFocused.raw,
    });

    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.FOCUS_PREVIOUS_TERMINAL.id,
      keybinding: 'ctrlcmd+alt+up',
      when: IsTerminalFocused.raw,
    });

    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.TOGGLE_TERMINAL.id,
      keybinding: 'ctrl+`',
    });
  }
}
