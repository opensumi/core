import { ElectronAppConfig } from './types';
import { CodeWindow } from './window';
import { Injector } from '@ali/common-di';
import { app } from 'electron';

export class ElectronMainApp {

  private codeWindows: Set<CodeWindow> = new Set();

  private injector = new Injector();

  constructor(private config: ElectronAppConfig) {
    this.injector.addProviders({
      token: ElectronAppConfig,
      useValue: config,
    });
    app.on('ready', () => {
      this.loadWorkspace(config.startUpWorkspace);
    });

  }

  loadWorkspace(workspace?: string) {
    const window = this.injector.get(CodeWindow, [this.config.startUpWorkspace]);
    this.codeWindows.add(window);
    window.start();
    window.onDispose(() => {
      this.codeWindows.delete(window);
    });
  }

}
