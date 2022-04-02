import { IDisposable } from '@opensumi/ide-utils';

import { IElectronMainApi } from './electron';

export interface INativeMenuTemplate {
  id?: string;
  label?: string;
  type?: 'separator' | 'checkbox';
  submenu?: INativeMenuTemplate[];
  accelerator?: string;
  disabled?: boolean;
  selected?: boolean;
  action?: boolean;
  role?: string;
  checked?: boolean;
}

export interface IElectronMainMenuService extends IElectronMainApi<'menuClick' | 'menuClose'> {
  showContextMenu(template: INativeMenuTemplate, webContentsId: number): Promise<void>;
  setApplicationMenu(template: INativeMenuTemplate, windowId: number): Promise<void>;
  on(event: 'menuClick', listener: (targetId: string, menuId: string) => void): IDisposable;
  on(event: 'menuClose', listener: (targetId: string, contextMenuId: string) => void): IDisposable;
  runNativeRoleAction(actionName: string): Promise<void>;
}

export const IElectronMainMenuService = 'IElectronMainMenuService';

export interface ISumiMenuExtendInfo {
  command: string;
  extraDesc?: string;
}
