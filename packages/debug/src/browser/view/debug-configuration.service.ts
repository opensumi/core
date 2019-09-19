import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { DebugConfigurationManager } from '../debug-configuration-manager';
import { observable, action } from 'mobx';
import { DebugSessionOptions } from '../../common';
import { URI } from '@ali/ide-core-browser';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugViewModel } from './debug-view-model';
import { IDebugSessionManager } from '../../common/debug-session';

@Injectable()
export class DebugConfigurationService {
  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(DebugConfigurationManager)
  debugConfigurationManager: DebugConfigurationManager;

  @Autowired(IDebugSessionManager)
  debugSessionManager: DebugSessionManager;

  @Autowired(DebugViewModel)
  debugViewModel: DebugViewModel;

  constructor() {
    this.debugConfigurationManager.onDidChange(() => {
      this.updateConfigurationOptions();
    });
  }

  @observable
  currentValue: string = '__NO_CONF__';

  @observable.shallow
  configurationOptions: DebugSessionOptions[] = this.debugConfigurationManager.all || [];

  @action
  updateConfigurationOptions() {
    const { current } = this.debugConfigurationManager;
    this.configurationOptions = this.debugConfigurationManager.all;
    this.currentValue = current ? this.toValue(current) : '__NO_CONF__';
  }

  start = async () => {
    const configuration = this.debugConfigurationManager.current;
    if (configuration) {
      const session = await this.debugSessionManager.start(configuration);
      if (session) {
        this.debugViewModel.init(session);
      }
    } else {
      this.debugConfigurationManager.addConfiguration();
    }
  }

  openConfiguration = () => {
    this.debugConfigurationManager.openConfiguration();
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
}
