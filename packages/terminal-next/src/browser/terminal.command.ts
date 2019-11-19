import { Command } from '@ali/ide-core-common';
import { getIcon, ROTATE_TYPE } from '@ali/ide-core-browser/lib/icon';

export const terminalAdd: Command = {
  id: 'terminal.add',
  label: 'add terminal',
  iconClass: getIcon('plus'),
  category: 'terminal',
};

export const terminalRemove: Command = {
  id: 'terminal.remove',
  label: 'remove terminal',
  iconClass: getIcon('delete'),
  category: 'terminal',
};

export const terminalExpand: Command = {
  id: 'terminal.expand',
  label: 'expand terminal',
  iconClass: getIcon('up'),
  toogleIconClass: getIcon('up', ROTATE_TYPE.rotate_180),
  category: 'terminal',
};

export const terminalClear: Command = {
  id: 'terminal.clear',
  label: 'clear terminal',
  iconClass: getIcon('clear'),
  category: 'terminal',
};

export const terminalSplit: Command = {
  id: 'terminal.split',
  label: 'split terminal',
  iconClass: getIcon('embed'),
  category: 'terminal',
};

export const toggleBottomPanel: Command = {
  id: 'main-layout.bottom-panel.toggle',
};
