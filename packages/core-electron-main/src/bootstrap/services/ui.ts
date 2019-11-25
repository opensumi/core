import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ElectronMainApiProvider, ElectronMainContribution, ElectronMainApiRegistry } from '../types';
import { BrowserWindow, dialog, shell } from 'electron';
import { ElectronMainMenuService } from './menu';
import { Domain, isWindows } from '@ali/ide-core-common';
import { stat } from 'fs-extra';
import { dirname } from 'path';
import { spawn } from 'child_process';

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

  async showOpenDialog(windowId: number, options: Electron.OpenDialogOptions): Promise<string[] | undefined> {
    // TODO electron 6.0好像api有变动, 目前适应5.0.10
    return new Promise((resolve, reject) => {
      try {
        dialog.showOpenDialog(BrowserWindow.fromId(windowId), options, (paths) => {
          resolve(paths);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  async showSaveDialog(windowId: number, options: Electron.SaveDialogOptions): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      try {
        dialog.showSaveDialog(BrowserWindow.fromId(windowId), options, (path) => {
          resolve(path);
        });
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
