import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ElectronMainApiProvider, ElectronMainContribution, ElectronMainApiRegistry } from '../types';
import { BrowserWindow, dialog, shell, webContents } from 'electron';
import { ElectronMainMenuService } from './menu';
import { Domain, isWindows } from '@ali/ide-core-common';
import { stat } from 'fs-extra';
import { dirname } from 'path';
import { spawn } from 'child_process';
import * as semver from 'semver';

@Injectable()
export class ElectronMainUIService extends ElectronMainApiProvider<'menuClick' | 'menuClose'> {

  async maximize(windowId) {
    BrowserWindow.fromId(windowId).maximize();
  }

  async openItem(path: string) {
    shell.openItem(path);
  }

  async openExternal(uri: string) {
    shell.openExternal(uri);
  }

  async moveToTrash(path: string) {
    shell.moveItemToTrash(path);
  }

  async revealInFinder(path: string) {
    shell.showItemInFolder(path);
  }

  async revealInSystemTerminal(path: string) {
    const fileStat = await stat(path);
    let targetPath = path;
    if ( !fileStat.isDirectory() ) {
      targetPath = dirname(path);
    }
    openInTerminal(targetPath);
  }

  setZoomFactor(webContentsId: number, options: { value?: number, delta?: number; } = {}) {
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
    // TODO electron 6.0好像api有变动, 目前适应5.0.10
    return new Promise((resolve, reject) => {
      try {
        if (semver.lt(process.versions.electron, '6.0.0')) {
          (dialog as any).showOpenDialog(BrowserWindow.fromId(windowId), options, (paths) => {
            resolve(paths);
          });
        } else {
          dialog.showOpenDialog(BrowserWindow.fromId(windowId), options).then((value) => {
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
          dialog.showSaveDialog(BrowserWindow.fromId(windowId), options).then((value) => {
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

}

@Domain(ElectronMainContribution)
export class UIElectronMainContribution implements ElectronMainContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerMainApi(registry: ElectronMainApiRegistry) {
    registry.registerMainApi('ui', this.injector.get(ElectronMainUIService));
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
