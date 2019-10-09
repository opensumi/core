import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { DebugConfigurationManager } from '../debug-configuration-manager';
import { observable, action } from 'mobx';
import { DebugSessionOptions } from '../../common';
import { URI } from '@ali/ide-core-browser';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugViewModel } from './debug-view-model';
import { DebugState } from '../debug-session';

@Injectable()
export class DebugWatchService {

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

}
