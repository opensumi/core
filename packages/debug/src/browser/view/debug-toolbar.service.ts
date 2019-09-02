import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { DebugConfigurationManager } from '../debug-configuration-manager';
import { observable, action } from 'mobx';
import { DebugSessionOptions } from '../debug-session-options';
import { URI } from '@ali/ide-core-browser';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugViewModel } from './debug-view-model';
import { DebugState } from '../debug-session';

@Injectable()
export class DebugToolbarService {

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @observable
  state: DebugState;

  @observable
  sessionCount: number;

  constructor() {
    this.model.onDidChange(() => {
      this.updateModel();
    });
  }

  @action
  updateModel() {
    this.state = this.model.state;
    this.sessionCount = this.model.sessionCount;
  }

  doStart = () => {
    return this.model.start();
  }

  doRestart = () => {
    return this.model.restart();
  }

  doStop = () => {
    return this.model.currentSession && this.model.currentSession.terminate();
  }
  doContinue = () => {
    return this.model.currentThread && this.model.currentThread.continue();
  }
  doPause = () => {
    return this.model.currentThread && this.model.currentThread.pause();
  }
  doStepOver = () => {
    return this.model.currentThread && this.model.currentThread.stepOver();
  }
  doStepIn = () => {
    return this.model.currentThread && this.model.currentThread.stepIn();
  }
  doStepOut = () => {
    return this.model.currentThread && this.model.currentThread.stepOut();
  }

}
