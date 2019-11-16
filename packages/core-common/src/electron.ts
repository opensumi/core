import { IDisposable } from './disposable';
import * as Electron from 'electron';

export interface IElectronMainApi<Events> {

  on(event: Events, listener: (...args) => void) :IDisposable;

}


export interface IElectronMainUIService extends IElectronMainApi<void> {
  
  openItem(path: string): void;

  openExternal(uri: string): void;
  
  moveToTrash(path: string): Promise<void>;

  maximize(windowId: number): Promise<void>;

  showOpenDialog(windowId: number, options:Electron.OpenDialogOptions ): Promise<string[] >;

  showSaveDialog(windowId: number, options:Electron.SaveDialogOptions ): Promise<string | undefined>;

}

export const IElectronMainUIService = Symbol('IElectronMainUIService');

export interface IElectronMainLifeCycleService extends IElectronMainApi<void> {
  minimizeWindow(windowId: number);
  fullscreenWindow(windowId: number);
  maximizeWindow(windowId: number);
  unmaximizeWindow(windowId: number);
  closeWindow(windowId: number);
  reloadWindow(windowId: number);

  /**
   * 打开新的工作区
   * @param workspace 工作区主Uri
   * @param windowId 指定的window
   */
  openWorkspace(workspace?: string, windowId?: number);

  /**
   * 在资源管理器里打开文件
   * @param path 文件路径（不带file协议头)
   */
  revealInFinder(path: string);

  /**
   * 在系统终端中打开文件路径
   * @param path 文件路径（不带file协议头)
   */
  revealInSystemTerminal(path: string);

}

export const IElectronMainLifeCycleService = Symbol('IElectronMainLifeCycleService');