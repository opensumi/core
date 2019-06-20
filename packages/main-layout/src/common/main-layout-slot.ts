import { SlotLocation as SlotLocationType } from '@ali/ide-core-browser';

export type SlotLocation = SlotLocationType;

export const SlotLocation =  {
  menuBar: Symbol('menu-bar'),
  activatorBar: Symbol('activator-bar'),
  activatorPanel: Symbol('activator-panel'),
  topPanel: Symbol('top-panel'),
  bottomPanel: Symbol('bottom-panel'),
  subsidiaryPanel: Symbol('subsidiary-panel'),
  statusBar: Symbol('status-bar'),
  commandBar: Symbol('command-bar'),

  top: 'top',
  left: 'left',
  right: 'right',
  main: 'main',
  bottom: 'bottom',
  bottomBar: 'bottomBar',
};
