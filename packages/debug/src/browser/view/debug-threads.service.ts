import { Injectable, Autowired } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { DebugCallStackItemTypeKey } from '../contextkeys/debug-call-stack-item-type-key';
import { DebugThread } from '../model/debug-thread';

@Injectable()
export class DebugThreadsService {
  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(DebugViewModel)
  protected readonly viewModel: DebugViewModel;

  @Autowired(DebugCallStackItemTypeKey)
  protected readonly debugCallStackItemTypeKey: DebugCallStackItemTypeKey;

  @observable.deep
  currentThread: DebugThread | undefined;

  @observable
  isMultiSesssion: boolean;

  constructor() {
    this.init();
  }

  async init() {
    this.viewModel.onDidChange(() => {
      this.updateModel();
    });
  }

  @action
  updateModel() {
    // TODO: 支持多Thread
    this.currentThread = this.viewModel.currentThread;
    this.isMultiSesssion = this.viewModel.sessionCount > 1;
  }

}
