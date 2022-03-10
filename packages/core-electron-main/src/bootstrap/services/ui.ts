import { spawn } from 'child_process';
import { dirname } from 'path';
import qs from 'querystring';

import { BrowserWindow, dialog, shell, webContents } from 'electron';
import { stat } from 'fs-extra';
import semver from 'semver';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Domain, isWindows, IEventBus, URI } from '@opensumi/ide-core-common';
import {
  IElectronMainUIService,
  IElectronMainUIServiceShape,
  IElectronPlainWebviewWindowOptions,
} from '@opensumi/ide-core-common/lib/electron';

import { ElectronMainApiProvider, ElectronMainContribution, ElectronMainApiRegistry } from '../types';


import { WindowCreatedEvent } from './events';


@Injectable()
export class ElectronMainUIService
  extends ElectronMainApiProvider<'fullScreenStatusChange' | 'windowClosed' | 'maximizeStatusChange'>
  implements IElectronMainUIServiceShape
{
  @Autowired(IEventBus)
  eventBus: IEventBus;

  constructor() {
    super();
    this.eventBus.on(WindowCreatedEvent, (e) => {
      const window = e.payload;
      window.getBrowserWindow().on('enter-full-screen', () => {
        this.fireFullScreenChangedEvent(window.getBrowserWindow().id, true);
      });
      window.getBrowserWindow().on('leave-full-screen', () => {
        this.fireFullScreenChangedEvent(window.getBrowserWindow().id, false);
      });
      window.getBrowserWindow().on('maximize', () => {
        this.fireMaximizeChangedEvent(window.getBrowserWindow().id, true);
      });
      window.getBrowserWindow().on('unmaximize', () => {
        this.fireMaximizeChangedEvent(window.getBrowserWindow().id, false);
      });
      window.getBrowserWindow().on('resized', () => {
        this.fireMaximizeChangedEvent(window.getBrowserWindow().id, window.getBrowserWindow().isMaximized());
      });
      window.getBrowserWindow().on('moved', () => {
        this.fireMaximizeChangedEvent(window.getBrowserWindow().id, window.getBrowserWindow().isMaximized());
      });
    });
  }

  fireFullScreenChangedEvent(windowId: number, isFullScreen: boolean) {
    this.eventEmitter.fire('fullScreenStatusChange', windowId, isFullScreen);
  }

  fireMaximizeChangedEvent(windowId: number, isMaximized: boolean) {
    this.eventEmitter.fire('maximizeStatusChange', windowId, isMaximized);
  }

  async isFullScreen(windowId: number) {
    const win = BrowserWindow.fromId(windowId);
    return win ? win.isFullScreen() : false;
  }

  async isMaximized(windowId: number) {
    const win = BrowserWindow.fromId(windowId);
    return win ? win.isMaximized() : false;
  }

  async maximize(windowId: number) {
    BrowserWindow.fromId(windowId)?.maximize();
  }

  async openPath(path: string) {
    return await shell.openPath(path);
  }

  async openExternal(uri: string) {
    await shell.openExternal(uri);
  }

  async moveToTrash(path: string) {
    if (semver.lt(process.versions.electron, '13.0.0')) {
      // Removed: shell.moveItemToTrash()
      // https://www.electronjs.org/docs/latest/breaking-changes#removed-shellmoveitemtotrash
      await (shell as any).moveItemToTrash(path);
    } else {
      await shell.trashItem(path);
    }
  }

  async revealInFinder(path: string) {
    await shell.showItemInFolder(path);
  }

  async revealInSystemTerminal(path: string) {
    const fileStat = await stat(path);
    let targetPath = path;
    if (!fileStat.isDirectory()) {
      targetPath = dirname(path);
    }
    openInTerminal(targetPath);
  }

  setZoomFactor(webContentsId: number, options: { value?: number; delta?: number } = {}) {
    const contents = webContents.fromId(webContentsId);
    if (contents) {
      if (options.value) {
        contents.setZoomFactor(options.value);
      }
      if (options.delta) {
        if (semver.lt(process.versions.electron, '5.0.0')) {
          (contents as any).getZoomFactor((zoomFactor) => {
            contents.setZoomFactor(zoomFactor + options.delta);
          });
        } else {
          contents.setZoomFactor(contents.getZoomFactor() + options.delta);
        }
      }
    }
  }

  async showOpenDialog(windowId: number, options: Electron.OpenDialogOptions): Promise<string[] | undefined> {
    return new Promise((resolve, reject) => {
      try {
        if (semver.lt(process.versions.electron, '6.0.0')) {
          (dialog as any).showOpenDialog(BrowserWindow.fromId(windowId), options, (paths) => {
            resolve(paths);
          });
        } else {
          const win = BrowserWindow.fromId(windowId);
          if (!win) {
            return reject(new Error(`BrowserWindow ${windowId} not found`));
          }
          dialog.showOpenDialog(win, options).then((value) => {
            if (value.canceled) {
              resolve(undefined);
            } else {
              resolve(value.filePaths);
            }
          }, reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  }
  async showSaveDialog(windowId: number, options: Electron.SaveDialogOptions): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      try {
        if (semver.lt(process.versions.electron, '6.0.0')) {
          (dialog as any).showSaveDialog(BrowserWindow.fromId(windowId), options, (path) => {
            resolve(path);
          });
        } else {
          const win = BrowserWindow.fromId(windowId);
          if (!win) {
            return reject(new Error(`BrowserWindow ${windowId} not found`));
          }
          dialog.showSaveDialog(win, options).then((value) => {
            if (value.canceled) {
              resolve(undefined);
            } else {
              resolve(value.filePath);
            }
          }, reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  async createBrowserWindow(options?: IElectronPlainWebviewWindowOptions): Promise<number> {
    const window = new BrowserWindow(options);
    const windowId = window.id;
    window.once('closed', () => {
      this.eventEmitter.fire('windowClosed', windowId);
    });
    return window.id;
  }

  async browserWindowLoadUrl(windowId: number, url: string): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    const formattedURL = new URL(url).toString();
    const urlParsed = URI.parse(formattedURL);
    const queryString = qs.stringify({
      ...qs.parse(urlParsed.query),
      windowId,
    });
    window.loadURL(urlParsed.withQuery(queryString).toString(true));
    return new Promise((resolve, reject) => {
      const resolved = () => {
        resolve();
        window.webContents.removeListener('did-finish-load', resolved);
        window.webContents.removeListener('did-fail-load', rejected);
      };
      const rejected = (_event, _errorCode, desc: string) => {
        reject(new Error(desc));
        window.webContents.removeListener('did-finish-load', resolved);
        window.webContents.removeListener('did-fail-load', rejected);
      };
      window.webContents.once('did-finish-load', resolved);
      window.webContents.once('did-fail-load', rejected);
    });
  }

  async closeBrowserWindow(windowId: number): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    window.close();
    return new Promise<void>((resolve) => {
      window.once('closed', () => {
        resolve();
      });
    });
  }

  async postMessageToBrowserWindow(windowId: number, channel: string, message: any): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    window.webContents.send(channel, message);
  }

  async getWebContentsId(windowId): Promise<number> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    return window.webContents.id;
  }

  async showBrowserWindow(windowId: number): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    window.show();
  }

  async hideBrowserWindow(windowId: number): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    window.hide();
  }

  async setSize(windowId: number, size: { width: number; height: number }): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    window.setSize(size.width, size.height);
  }

  async setAlwaysOnTop(windowId: number, flag: boolean): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error('window with windowId ' + windowId + ' does not exist!');
    }
    window.setAlwaysOnTop(flag);
  }
}

@Domain(ElectronMainContribution)
export class UIElectronMainContribution implements ElectronMainContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerMainApi(registry: ElectronMainApiRegistry) {
    registry.registerMainApi(IElectronMainUIService, this.injector.get(ElectronMainUIService));
  }
}

export async function openInTerminal(dir: string) {
  if (isWindows) {
    spawn('cmd', ['/s', '/c', 'start', 'cmd.exe', '/K', 'cd', '/D', dir], {
      detached: true,
    });
  } else {
    spawn('open', ['-a', 'Terminal', dir], {
      detached: true,
    });
  }
}
