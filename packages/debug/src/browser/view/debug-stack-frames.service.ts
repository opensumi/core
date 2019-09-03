import { Injectable, Autowired } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { DebugCallStackItemTypeKey } from '../contextkeys/debug-call-stack-item-type-key';
import { DebugStackFrame } from '../model/debug-stack-frame';
import { EDITOR_COMMANDS, URI, CommandService } from '@ali/ide-core-browser';

@Injectable()
export class DebugStackFramesService {
  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(DebugViewModel)
  protected readonly viewModel: DebugViewModel;

  @Autowired(DebugCallStackItemTypeKey)
  protected readonly debugCallStackItemTypeKey: DebugCallStackItemTypeKey;

  @Autowired(CommandService)
  commandService: CommandService;

  @observable
  stackFrames: DebugStackFrame[];

  @observable
  currentStackFrames: DebugStackFrame | undefined;

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
    if (this.viewModel.currentThread) {
      this.stackFrames = this.viewModel.currentThread.frames;
    } else {
      this.stackFrames = [];
    }
    this.currentStackFrames = this.viewModel.currentFrame;
  }

  open = (uri: URI) => {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: false });
  }
}
