import { KeybindingContribution, KeybindingRegistry } from '@opensumi/ide-core-browser';
import { IsTerminalFocused } from '@opensumi/ide-core-browser/lib/contextkey';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';
import { Domain, isWindows } from '@opensumi/ide-core-common';

import { TERMINAL_COMMANDS } from '../../common';

@Domain(KeybindingContribution)
export class TerminalKeybindinngContribution implements KeybindingContribution {
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
  }
}
