import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { DebugConfigurationManager } from '../debug-configuration-manager';
import { observable, action } from 'mobx';
import { DebugSessionOptions } from '../../common';
import { URI, StorageProvider, IStorage, STORAGE_NAMESPACE, PreferenceService } from '@ali/ide-core-browser';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugViewModel } from './debug-view-model';
import { IDebugSessionManager } from '../../common/debug-session';
import { DebugConsoleService } from './debug-console.service';

@Injectable()
export class DebugConfigurationService {
  @Autowired(IWorkspaceService)
  protected workspaceService: IWorkspaceService;

  @Autowired(DebugConfigurationManager)
  protected debugConfigurationManager: DebugConfigurationManager;

  @Autowired(DebugConsoleService)
  protected debugConsole: DebugConsoleService;

  @Autowired(IDebugSessionManager)
  protected debugSessionManager: DebugSessionManager;

  @Autowired(DebugViewModel)
  protected debugViewModel: DebugViewModel;

  @Autowired(DebugConsoleService)
  protected debugConsoleService: DebugConsoleService;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  constructor() {
    this.init();
  }

  @observable
  currentValue: string = '__NO_CONF__';

  @observable
  float: boolean = true;

  @observable.shallow
  configurationOptions: DebugSessionOptions[] = this.debugConfigurationManager.all || [];

  async init() {
    const name = 'debug.toolbar.float';
    this.debugConfigurationManager.onDidChange(() => {
      this.updateConfigurationOptions();
    });
    this.preferenceService.onPreferenceChanged((event) => {
      const { preferenceName, newValue } = event;
      if (preferenceName === name) {
        this.float = newValue;
      }
    });
    this.float = !!this.preferenceService.get<boolean>(name);
    this.currentValue = await this.getCurrentConfiguration() || '__NO_CONF__';
  }

  @action
  updateConfigurationOptions() {
    const { current } = this.debugConfigurationManager;
    this.configurationOptions = this.debugConfigurationManager.all;
    if (current) {
      const currentValue = this.toValue(current);
      this.setCurrentConfiguration(currentValue);
      this.currentValue = currentValue;
    } else {
      this.currentValue = '__NO_CONF__';
    }
  }

  start = async () => {
    const configuration = this.debugConfigurationManager.current;
    if (configuration) {
      this.debugSessionManager.start(configuration);
    } else {
      this.debugConfigurationManager.addConfiguration();
    }
  }

  openConfiguration = () => {
    this.debugConfigurationManager.openConfiguration();
  }

  openDebugConsole = () => {
    this.debugConsoleService.activate();
  }

  addConfiguration = () => {
    this.debugConfigurationManager.addConfiguration();
  }

  updateConfiguration = (name, workspaceFolderUri) => {
    this.debugConfigurationManager.current = this.debugConfigurationManager.find(name, workspaceFolderUri);
  }

  toValue({ configuration, workspaceFolderUri }: DebugSessionOptions) {
    if (!workspaceFolderUri) {
      return configuration.name;
    }
    return configuration.name + '__CONF__' + workspaceFolderUri;
  }

  toName = ({ configuration, workspaceFolderUri }: DebugSessionOptions) => {
    if (!workspaceFolderUri || !this.workspaceService.isMultiRootWorkspaceEnabled) {
      return configuration.name;
    }
    return configuration.name + ' (' + new URI(workspaceFolderUri).path.base + ')';
  }

  async getCurrentConfiguration() {
    const storage: IStorage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    const currentConfiguration = await storage.get<string>('currentConfiguration');
    return currentConfiguration;
  }

  async setCurrentConfiguration(value: string) {
    const storage: IStorage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    await storage.set('currentConfiguration', value);
  }
}
