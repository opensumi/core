import { Injectable, Autowired } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { DebugConfigurationManager } from '../../debug-configuration-manager';
import { observable, action } from 'mobx';
import { DebugSessionOptions, DEFAULT_ADD_CONFIGURATION_KEY, DEFAULT_CONFIGURATION_NAME_SEPARATOR, DEFAULT_CONFIGURATION_INDEX_SEPARATOR } from '../../../common';
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
  currentValue: string = DEFAULT_ADD_CONFIGURATION_KEY;

  @observable
  float: boolean = true;

  @observable
  isMultiRootWorkspace: boolean;

  @observable
  workspaceRoots: string[] = [];

  @observable.shallow
  configurationOptions: DebugSessionOptions[];

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
        const valueIndex = preValue.indexOf(DEFAULT_CONFIGURATION_NAME_SEPARATOR);
        const configurationName = preValue.slice(0, valueIndex);
        let nextValue;
        if (this.configurationOptions.length > 0) {
          let configuration = this.configurationOptions.find((option) => option.configuration.name === configurationName);
          if (!!configuration) {
            configuration = this.configurationOptions[0];
          }
          nextValue  = this.toValue(configuration!);
        } else {
          nextValue = DEFAULT_ADD_CONFIGURATION_KEY;
        }
        this.updateCurrentValue(nextValue);
      }
    } else if (this.debugConfigurationManager.current) {
      this.updateCurrentValue(this.toValue(this.debugConfigurationManager.current));
    }
  }

  async init() {
    await this.updateConfigurationOptions();
    await this.initCurrentConfiguration();
    this.debugConfigurationManager.onDidChange(async () => {
      this.updateConfigurationOptions();
      await this.initCurrentConfiguration();
    });
    this.preferenceService.onPreferenceChanged((event) => {
      const { preferenceName, newValue } = event;
      if (preferenceName === 'debug.toolbar.float') {
        if (this.float !== newValue) {
          this.updateFloat(newValue);
        }
      }
    });
    await this.updateWorkspaceState();
    // onWorkspaceLocationChanged 事件不能满足实时更新workspaceRoots的需求
    // onWorkspaceChanged 能获取到在工作区状态添加文件夹的节点变化
    this.workspaceService.onWorkspaceChanged(async () => {
      await this.updateWorkspaceState();
    });
    this.updateFloat(!!this.preferenceService.get<boolean>('debug.toolbar.float'));
  }

  @action
  async updateWorkspaceState() {
    this.isMultiRootWorkspace = this.workspaceService.isMultiRootWorkspaceOpened;
    this.workspaceRoots = (await this.workspaceService.tryGetRoots()).map((root) => root.uri);
  }

  @action
  updateFloat(value: boolean) {
    this.float = value;
  }

  @action
  updateCurrentValue(value: string) {
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
      this.updateCurrentValue(DEFAULT_ADD_CONFIGURATION_KEY);
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
    const { current } = this.debugConfigurationManager;
    const uri = current?.workspaceFolderUri;
    this.debugConfigurationManager.openConfiguration(uri);
  }

  openDebugConsole = () => {
    this.debugConsoleService.activate();
  }

  addConfiguration = (eventOrUri?: React.MouseEvent<HTMLElement, MouseEvent> | string) => {
    this.debugConfigurationManager.addConfiguration(typeof eventOrUri === 'string' ? eventOrUri : undefined);
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
    return configuration.name + DEFAULT_CONFIGURATION_NAME_SEPARATOR + workspaceFolderUri + DEFAULT_CONFIGURATION_INDEX_SEPARATOR + index;
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
