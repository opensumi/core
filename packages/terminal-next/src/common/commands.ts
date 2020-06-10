import { localize } from '@ali/ide-core-common';

export namespace TERMINAL_COMMANDS {
  const CATEGORY = localize('terminal.name');

  export const SPLIT = {
    id: 'terminal.split',
    label: localize('terminal.split'),
    category: CATEGORY,
  };

  export const ADD = {
    id: 'terminal.add',
    label: 'add terminal',
    category: CATEGORY,
  };

  export const REMOVE = {
    id: 'terminal.remove',
    label: 'remove terminal',
    category: CATEGORY,
  };

  export const CLEAR = {
    id: 'terminal.clear',
    label: localize('terminal.clear'),
    category: CATEGORY,
  };

  export const OPEN_SEARCH = {
    id: 'terminal.search',
    label: localize('terminal.search'),
    category: CATEGORY,
  };

  export const SEARCH_NEXT = {
    id: 'terminal.search.next',
    label: localize('terminal.search.next'),
    category: CATEGORY,
  };

  export const OPEN_WITH_PATH = {
    id: 'terminal.openWithPath',
    label: '%terminal.openWithPath%',
    category: CATEGORY,
  };

  export const CLEAR_CONTENT = {
    id: 'terminal.clearContent',
    label: localize('terminal.menu.clearCurrentGroup'),
    category: CATEGORY,
  };

  export const CLEAR_ALL_CONTENT = {
    id: 'terminal.clearAllContent',
    label: localize('terminal.menu.clearAllGroups'),
  };

  export const TAB_RENAME = {
    id: 'terminal.tabRename',
  };

  export const SELECT_ALL_CONTENT = {
    id: 'terminal.selectAllContent',
  };

  export const MORE_SETTINGS = {
    id: 'terminal.moreSettings',
    label: localize('terminal.menu.moreSettings'),
  };

  export const SELECT_TYPE = {
    id: 'terminal.selectType',
  };

  export const SELECT_ZSH = {
    id: 'terminal.selectTypeZsh',
    label: 'zsh',
  };

  export const SELECT_BASH = {
    id: 'terminal.selectTypeBash',
    label: 'bash',
  };

  export const SELECT_SH = {
    id: 'terminal.selectTypeSh',
    label: 'sh',
  };

  export const SELECT_CMD = {
    id: 'terminal.selectTypeCMD',
    label: 'cmd',
  };

  export const SELECT_POWERSHELL = {
    id: 'terminal.selectTypePowerShell',
    label: 'powershell',
  };
}
