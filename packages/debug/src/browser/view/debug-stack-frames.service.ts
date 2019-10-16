import { Injectable, Autowired } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { DebugCallStackItemTypeKey } from '../contextkeys/debug-call-stack-item-type-key';
import { DebugStackFrame } from '../model/debug-stack-frame';
import { CommandService } from '@ali/ide-core-browser';

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
  isMultiSesssion: boolean;

  @observable
  framesErrorMessage: string;

  @observable
  canLoadMore: boolean = false;

  @observable
  currentFrame: DebugStackFrame | undefined;

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
    const thread = this.viewModel.currentThread;
    if (thread) {
      this.stackFrames = thread.frames;
      if (!this.currentFrame) {
        this.currentFrame = thread.frames[0];
      }
      if (thread.stoppedDetails) {
        const { framesErrorMessage, totalFrames } = thread.stoppedDetails;
        this.framesErrorMessage = framesErrorMessage || '';
        if (totalFrames && totalFrames > thread.frameCount) {
          this.canLoadMore = true;
        } else {
          this.canLoadMore = false;
        }
      }
    } else {
      this.canLoadMore = false;
      this.stackFrames = [];
    }
    this.currentFrame = this.viewModel.currentFrame;
  }

  @action
  setCurentFrame = (frame) => {
    this.currentFrame = frame;
  }

  @action
  loadMore = async () => {
    const thread = this.viewModel.currentThread;
    if (!thread) {
      return ;
    }
    const frames = await thread.fetchFrames();
    if (frames[0]) {
      const frame =  frames[0];
      thread.currentFrame = frame;
      this.currentFrame = frame;
      if (frame && frame.source) {
        frame.source.open({}, frame);
      }
    }
  }
}
