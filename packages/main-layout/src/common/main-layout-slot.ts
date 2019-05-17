import { SlotLocation as SlotLocationType } from '@ali/ide-core-browser';

export type SlotLocation = SlotLocationType;

export const SlotLocation =  {
  menuBar: Symbol('menu-bar'),
  leftPanel: Symbol('left-panel'),
  topPanel: Symbol('top-panel'),
  bottomPanel: Symbol('bottom-panel'),
  rightPanel: Symbol('right-panel'),
  statusBar: Symbol('status-bar'),
  commandBar: Symbol('command-bar'),
};
