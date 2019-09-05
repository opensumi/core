import { IDisposable } from './disposable';
import * as Electron from 'electron';

export interface IElectronMainApi<Events> {

  on(event: Events, listener: (...args) => void) :IDisposable;

}


export interface IElectronMainUIService extends IElectronMainApi<void> {

  maximize(windowId: number): Promise<void>;

  showOpenDialog(windowId: number, options:Electron.OpenDialogOptions ): Promise<string[] >;

  showSaveDialog(windowId: number, options:Electron.SaveDialogOptions ): Promise<string | undefined>;

}

export const IElectronMainUIService = Symbol('IElectronMainUIService');

export interface IElectronMainLifeCycleService extends IElectronMainApi<void> {

  /**
   * 打开新的工作区
   * @param workspace 工作区主Uri
   * @param windowId 指定的window
   */
  openWorkspace(workspace?: string, windowId?: number);

}

export const IElectronMainLifeCycleService = Symbol('IElectronMainLifeCycleService');