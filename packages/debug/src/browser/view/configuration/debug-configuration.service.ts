import { Injectable, Autowired } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { DebugConfigurationManager } from '../../debug-configuration-manager';
import { observable, action } from 'mobx';
import { DebugSessionOptions } from '../../../common';
import { URI, StorageProvider, IStorage, STORAGE_NAMESPACE, PreferenceService, isUndefined } from '@ali/ide-core-browser';
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

  private _whenReady: Promise<void>;

  constructor() {
    this._whenReady = this.init();
  }

  @observable
  currentValue: string = '__NO_CONF__';

  @observable
  float: boolean = true;

  @observable.shallow
  configurationOptions: DebugSessionOptions[] = this.debugConfigurationManager.all || [];

  get whenReady() {
    return this._whenReady;
  }

  private async initCurrentConfiguration() {
    const preValue = await this.getCurrentConfiguration();
    const hasConfig = !!this.debugConfigurationManager.all.find((config) => this.toValue(config) === preValue);
    if (!!preValue) {
      if (hasConfig) {
        this.updateCurrentValue(preValue);
      } else {
        // 当找不到配置项时，根据下标顺序查找对应位置配置项
        const valueIndex = preValue.indexOf('__CONF__');
        const configurationName = preValue.slice(0, valueIndex);
        let nextValue;
        if (this.configurationOptions.length > 0) {
          let configuration = this.configurationOptions.find((option) => option.configuration.name === configurationName);
          if (!!configuration) {
            configuration = this.configurationOptions[0];
          }
          nextValue  = this.toValue(configuration!);
        } else {
          nextValue = '__NO_CONF__';
        }
        this.updateCurrentValue(nextValue);
      }
    } else if (this.debugConfigurationManager.current) {
      this.updateCurrentValue(this.toValue(this.debugConfigurationManager.current));
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
    if (isUndefined(index)) {
      const options = this.debugConfigurationManager.find(configuration.name, workspaceFolderUri);
      if (options && options.index) {
        return this.toValue(options);
      }
      return this.currentValue;
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
