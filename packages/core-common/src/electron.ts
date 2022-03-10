import Electron from 'electron';

import { IDisposable } from './disposable';
import { ExtensionCandidate } from './types';

export interface IElectronMainApi<Events> {
  on(event: Events, listener: (...args) => void): IDisposable;
}

export type IElectronPlainWebviewWindowOptions = Electron.BrowserWindowConstructorOptions;

export interface IElectronMainUIServiceShape {
  openPath(path: string): Promise<string>;

  openExternal(uri: string): void;

  moveToTrash(path: string): Promise<void>;

  isMaximized(windowId: number): Promise<boolean>;

  maximize(windowId: number): Promise<void>;

  isFullScreen(windowId: number): Promise<boolean>;

  showOpenDialog(windowId: number, options: Electron.OpenDialogOptions): Promise<string[] | undefined>;

  showSaveDialog(windowId: number, options: Electron.SaveDialogOptions): Promise<string | undefined>;

  setZoomFactor(webContentsId: number, options: { value?: number; delta?: number }): void;

  /**
   * 在资源管理器里打开文件
   * @param path 文件路径（不带file协议头)
   */
  revealInFinder(path: string): Promise<void>;

  /**
   * 在系统终端中打开文件路径
   * @param path 文件路径（不带file协议头)
   */
  revealInSystemTerminal(path: string): Promise<void>;

  /**
   * 创建一个browserWindow
   * @param options
   * @returns windowId
   */
  createBrowserWindow(options?: IElectronPlainWebviewWindowOptions): Promise<number>;

  /**
   * 显示指定的窗口
   * @param windowId
   */
  showBrowserWindow(windowId: number): Promise<void>;

  /**
   * 隐藏指定的窗口
   * @param windowId
   */
  hideBrowserWindow(windowId: number): Promise<void>;

  /**
   * 设置窗口大小
   * @param windowId
   * @param size
   */
  setSize(windowId: number, size: { width: number; height: number }): Promise<void>;

  /**
   * 设置窗口是否始终置顶
   * @param windowId
   * @param flag
   */
  setAlwaysOnTop(windowId: number, flag: boolean): Promise<void>;

  /**
   * 让一个指定的 browserWindow 加载一个url
   * @param windowId
   * @param url
   */
  browserWindowLoadUrl(windowId: number, url: string): Promise<void>;
  /**
   * 关闭一个browserWindow
   * @param windowId
   */
  closeBrowserWindow(windowId: number): Promise<void>;

  /**
   * 向一个browserWindow发送消息
   * @param windowId: window的id
   * @param message: 消息体，需要能被序列化
   */
  postMessageToBrowserWindow(windowId: number, channel: string, message: any): Promise<void>;

  /**
   * 获得一个 browserWindow 的 webContentsId
   * @param windowId
   */
  getWebContentsId(windowId: number): Promise<number>;
}

export interface IElectronMainUIService
  extends IElectronMainUIServiceShape,
    IElectronMainApi<'fullScreenStatusChange' | 'windowClosed' | 'maximizeStatusChange'> {}

export const IElectronMainUIService = 'IElectronMainUIService';

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
  setExtensionCandidate(candidate: ExtensionCandidate[], windowId: number): void;
}

export const IElectronMainLifeCycleService = 'IElectronMainLifeCycleService';

export interface IURLHandler {
  handleURL(url: string): Promise<boolean>;
}

export const IElectronURLService = 'IElectronURLService';

export interface IElectronURLService {
  open(url: string): Promise<boolean>;

  registerHandler(handler: IURLHandler): void;

  registerDefaultHandler(handler: IURLHandler): void;

  deregisterHandler(handler: IURLHandler): void;
}

export interface IElectronRendererURLService extends IElectronMainApi<string>, IElectronURLService {}
