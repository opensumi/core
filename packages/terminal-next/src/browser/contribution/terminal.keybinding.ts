import { Domain, isWindows } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';
import { TERMINAL_COMMANDS } from '../../common';
import { IsTerminalFocused } from '@ali/ide-core-browser/lib/contextkey';

@Domain(KeybindingContribution)
export class TerminalKeybindinngContribution implements KeybindingContribution {
  registerKeybindings(registry: KeybindingRegistry) {
    // 复制/粘贴/全选 不能影响到终端搜索组件的快捷键
    const ternimalFoucsedAndBlurSerchWidget = `${IsTerminalFocused.raw} && !inputFocus`;

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
      when: ternimalFoucsedAndBlurSerchWidget,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.PASTE.id,
      keybinding: isWindows ? 'ctrlcmd+shift+v' : 'ctrlcmd+v',
      when: ternimalFoucsedAndBlurSerchWidget,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.SELECT_ALL.id,
      keybinding: 'ctrlcmd+a',
      when: ternimalFoucsedAndBlurSerchWidget,
    });
  }
}
