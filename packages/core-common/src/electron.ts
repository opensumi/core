import { IDisposable } from './disposable';
import * as Electron from 'electron';
import { ExtensionCandiDate } from './types';

export interface IElectronMainApi<Events> {

  on(event: Events, listener: (...args) => void) :IDisposable;

}


export interface IElectronMainUIService extends IElectronMainApi<'fullScreenStatusChange'> {

  openItem(path: string): void;

  openExternal(uri: string): void;

  moveToTrash(path: string): Promise<void>;

  maximize(windowId: number): Promise<void>;

  isFullScreen(windowId: number): Promise<boolean>;

  showOpenDialog(windowId: number, options:Electron.OpenDialogOptions ): Promise<string[] >;

  showSaveDialog(windowId: number, options:Electron.SaveDialogOptions ): Promise<string | undefined>;

  setZoomFactor(webContentsId: number, options: { value?: number, delta?: number; });

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

export const IElectronMainUIService = Symbol('IElectronMainUIService');

export interface IElectronMainLifeCycleService extends IElectronMainApi<void> {
  minimizeWindow(windowId: number);
  fullscreenWindow(windowId: number);
  maximizeWindow(windowId: number);
  unmaximizeWindow(windowId: number);
  closeWindow(windowId: number);
  reloadWindow(windowId: number);

  /**
   * 在某个窗口打开新的工作区
   * @param workspace 工作区主Uri
   * @param options
   */
  openWorkspace(workspace: string, options?: any);

  setExtensionDir(path: string, windowId: number);
  setExtensionCandidate(candidate: ExtensionCandiDate[], windowId: number): void;
}

export const IElectronMainLifeCycleService = Symbol('IElectronMainLifeCycleService');
