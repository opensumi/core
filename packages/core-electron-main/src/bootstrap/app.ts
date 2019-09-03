import { ElectronAppConfig, ElectronMainApiRegistry, ElectronMainContribution, IElectronMainApp } from './types';
import { CodeWindow } from './window';
import { Injector, ConstructorOf } from '@ali/common-di';
import { app } from 'electron';
import { ElectronMainApiRegistryImpl } from './api';
import { createContributionProvider, ContributionProvider } from '@ali/ide-core-common';
import { serviceProviders } from './services';
import { ElectronMainModule } from '../electron-main-module';

export class ElectronMainApp {

  private codeWindows: Set<CodeWindow> = new Set();

  private injector = new Injector();

  private modules: ElectronMainModule[] = [];

  constructor(private config: ElectronAppConfig) {

    config.extensionDir = config.extensionDir || [];
    config.extraExtensions = config.extraExtensions || [];

    this.injector.addProviders({
      token: ElectronAppConfig,
      useValue: config,
    }, {
      token: IElectronMainApp,
      useValue: this,
    }, {
      token: ElectronMainApiRegistry,
      useClass: ElectronMainApiRegistryImpl,
    }, ...serviceProviders);
    createContributionProvider(this.injector, ElectronMainContribution);
    this.createElectronMainModules(this.config.modules);

    this.registerMainApis();
  }

  async init() {
    // TODO scheme start
    if (!app.isReady()) {
      await new Promise((resolve) => {
        app.on('ready', resolve);
      });
    }
  }

  registerMainApis() {
    for (const contribution of this.contributions ) {
      if (contribution.registerMainApi) {
        contribution.registerMainApi(this.injector.get(ElectronMainApiRegistry));
      }
    }
  }

  loadWorkspace(workspace?: string, metadata?: any): CodeWindow {
    const window = this.injector.get(CodeWindow, [workspace, metadata]);
    this.codeWindows.add(window);
    window.start();
    window.onDispose(() => {
      this.codeWindows.delete(window);
    });
    return window;
  }

  get contributions() {
    return (this.injector.get(ElectronMainContribution) as ContributionProvider<ElectronMainContribution>).getContributions();
  }

  getCodeWindows() {
    return Array.from(this.codeWindows.values());
  }

  private createElectronMainModules(Constructors: Array<ConstructorOf<ElectronMainModule>> = []) {

    for (const Constructor of Constructors) {
      this.modules.push(this.injector.get(Constructor));
    }
    for (const instance of this.modules) {
      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }

      if (instance.contributionProvider) {
        if (Array.isArray(instance.contributionProvider)) {
          for (const contributionProvider of instance.contributionProvider) {
            createContributionProvider(this.injector, contributionProvider);
          }
        } else {
          createContributionProvider(this.injector, instance.contributionProvider);
        }
      }
    }

  }

}
