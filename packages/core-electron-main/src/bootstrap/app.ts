import { ElectronAppConfig } from './types';
import { CodeWindow } from './window';
import { Injector } from '@ali/common-di';

export class ElectronMainApp {

  private codeWindows: CodeWindow[];

  private injector = new Injector();

  constructor(private config: ElectronAppConfig) {
    this.loadWorkspace();
    this.injector.addProviders({
      token: ElectronAppConfig,
      useValue: config,
    });
  }

  loadWorkspace(workspace?: string) {
    const window = new CodeWindow(this.config.startUpWorkspace);
    this.codeWindows.push(window);
    window.start();
  }

}
