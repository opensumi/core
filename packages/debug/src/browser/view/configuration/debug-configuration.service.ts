import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { URI, PreferenceService, isUndefined, PreferenceConfigurations } from '@opensumi/ide-core-browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceVariableContribution } from '@opensumi/ide-workspace/lib/browser/workspace-variable-contribution';

import {
  DebugSessionOptions,
  DEFAULT_ADD_CONFIGURATION_KEY,
  DEFAULT_CONFIGURATION_NAME_SEPARATOR,
  DEFAULT_CONFIGURATION_INDEX_SEPARATOR,
} from '../../../common';
import { DebugConfiguration } from '../../../common';
import { IDebugSessionManager } from '../../../common/debug-session';
import { DebugConfigurationManager } from '../../debug-configuration-manager';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugConsoleService } from '../console/debug-console.service';
import { DebugViewModel } from '../debug-view-model';

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

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(WorkspaceVariableContribution)
  protected readonly workspaceVariables: WorkspaceVariableContribution;

  @Autowired(PreferenceConfigurations)
  protected readonly preferenceConfigurations: PreferenceConfigurations;

  private _whenReady: Promise<void>;

  constructor() {
    this._whenReady = this.init();
  }

  @observable
  currentValue: string = DEFAULT_ADD_CONFIGURATION_KEY;

  @observable
  float = true;

  @observable
  isMultiRootWorkspace: boolean;

  @observable
  workspaceRoots: string[] = [];

  @observable.shallow
  configurationOptions: DebugSessionOptions[];

  @observable.shallow
  dynamicConfigurations: { type: string; label: string | undefined }[];

  get whenReady() {
    return this._whenReady;
  }

  async init() {
    await this.debugConfigurationManager.whenReady;
    await this.updateConfigurationOptions();
    // await this.initCurrentConfiguration();
    this.debugConfigurationManager.onDidChange(async () => {
      this.updateConfigurationOptions();
      // await this.initCurrentConfiguration();
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
  async updateConfigurationOptions() {
    this.configurationOptions = this.debugConfigurationManager.all;
    const { current } = this.debugConfigurationManager;
    if (current) {
      const currentValue = this.toValue(current);
      this.updateCurrentValue(currentValue);
    } else {
      this.updateCurrentValue(DEFAULT_ADD_CONFIGURATION_KEY);
    }
    this.dynamicConfigurations = await this.debugConfigurationManager.getDynamicConfigurationsSupportTypes();
    setTimeout(async () => {
      // 这里也许需要感知一下 Extension 的初始化事件做一下优化
      this.dynamicConfigurations = await this.debugConfigurationManager.getDynamicConfigurationsSupportTypes();
    }, 1000);
  }

  start = async () => {
    const configuration = this.debugConfigurationManager.current;
    if (configuration) {
      this.debugSessionManager.start(configuration);
    } else {
      this.debugConfigurationManager.addConfiguration();
    }
  };

  openConfiguration = () => {
    const { current } = this.debugConfigurationManager;
    const uri = current?.workspaceFolderUri;
    this.debugConfigurationManager.openConfiguration(uri);
  };

  openLaunchEditor = () => {
    this.debugConfigurationManager.openLaunchEditor();
  };

  openDebugConsole = () => {
    this.debugConsoleService.activate();
  };

  addConfiguration = (eventOrUri?: React.MouseEvent<HTMLElement, MouseEvent> | string) => {
    this.debugConfigurationManager.addConfiguration(typeof eventOrUri === 'string' ? eventOrUri : undefined);
  };

  getLaunchUri = () => {
    const workspaceFolderUri = this.workspaceVariables.getWorkspaceRootUri();
    const uri = new URI(workspaceFolderUri!.toString()).resolve(
      `${this.preferenceConfigurations.getPaths()[0]}/launch.json`,
    );
    return uri;
  };

  insertConfiguration = (config: DebugConfiguration) => {
    this.debugConfigurationManager.insertConfiguration(this.getLaunchUri(), config);
  };

  // 在 launch.json 中插入动态配置
  showDynamicQuickPickToInsert = async () => {
    const debugType = await this.debugConfigurationManager.showDynamicConfigurationsTypesQuickPick();
    if (debugType) {
      const config = await this.debugConfigurationManager.showDynamicConfigurationsQuickPick(debugType);
      if (config) {
        this.insertConfiguration(config);
      }
    }
  };

  updateConfiguration = (name: string, workspaceFolderUri: string, index: number) => {
    this.debugConfigurationManager.current = this.debugConfigurationManager.find(name, workspaceFolderUri, index);
  };

  // 展示动态配置的选项 QuickPick 并且直接运行
  showDynamicQuickPick = async (type: string) => {
    const config = await this.debugConfigurationManager.showDynamicConfigurationsQuickPick(type);
    if (config) {
      this.debugSessionManager.start({
        configuration: config,
        workspaceFolderUri: this.workspaceRoots[0],
        index: -1,
      });
    }
  };

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
    return (
      configuration.name +
      DEFAULT_CONFIGURATION_NAME_SEPARATOR +
      workspaceFolderUri +
      DEFAULT_CONFIGURATION_INDEX_SEPARATOR +
      index
    );
  }

  toName = ({ configuration, workspaceFolderUri }: DebugSessionOptions) => {
    if (!workspaceFolderUri || !this.workspaceService.isMultiRootWorkspaceEnabled) {
      return configuration.name;
    }
    return configuration.name + ' (' + new URI(workspaceFolderUri).path.base + ')';
  };
}
