import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { DebugState, DebugSession } from '../debug-session';

@Injectable()
export class DebugToolbarService {

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @observable
  state: DebugState;

  @observable
  sessionCount: number;

  @observable
  currentSession: DebugSession | undefined;

  constructor() {
    this.model.onDidChange(() => {
      this.updateModel();
    });
  }

  @action
  updateModel() {
    this.state = this.model.state;
    this.sessionCount = this.model.sessionCount;
    this.currentSession = this.model.currentSession;
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
