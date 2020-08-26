import { Injectable, Autowired } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { DebugConfigurationManager } from '../../debug-configuration-manager';
import { observable, action } from 'mobx';
import { DebugSessionOptions } from '../../../common';
import { URI, StorageProvider, IStorage, STORAGE_NAMESPACE, PreferenceService } from '@ali/ide-core-browser';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugViewModel } from '../debug-view-model';
import { IDebugSessionManager } from '../../../common/debug-session';
import { DebugConsoleService } from '../console/debug-console.service';

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

  private async initCurrentConfiguration() {
    const preValue = await this.getCurrentConfiguration();
    const hasConfig = !!this.debugConfigurationManager.all.find((config) => this.toValue(config) === preValue);
    if (hasConfig) {
      this.updateCurrentValue(preValue);
    }
  }

  async init() {
    await this.initCurrentConfiguration();
    this.debugConfigurationManager.onDidChange(async () => {
      this.updateConfigurationOptions();
      await this.initCurrentConfiguration();
    });
    this.preferenceService.onPreferenceChanged((event) => {
      const { preferenceName, newValue } = event;
      if (preferenceName === name) {
        this.float = newValue;
      }
    });
    this.float = !!this.preferenceService.get<boolean>('debug.toolbar.float');
  }

  @action updateCurrentValue(value: string) {
    this.currentValue = value;
  }

  @action
  updateConfigurationOptions() {
    const { current } = this.debugConfigurationManager;
    this.configurationOptions = this.debugConfigurationManager.all;
    if (current) {
      const currentValue = this.toValue(current);
      this.setCurrentConfiguration(currentValue);
      this.updateCurrentValue(currentValue);
    } else {
      this.updateCurrentValue('__NO_CONF__');
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

  updateConfiguration = (name: string, workspaceFolderUri: string, index: number) => {
    this.debugConfigurationManager.current = this.debugConfigurationManager.find(name, workspaceFolderUri, index);
  }

  toValue({ configuration, workspaceFolderUri, index }: DebugSessionOptions) {
    if (!workspaceFolderUri) {
      return configuration.name;
    }
    return configuration.name + '__CONF__' + workspaceFolderUri + '__INDEX__' + index;
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
