import { Injectable, Autowired } from '@ali/common-di';
import { DebugConsoleSession } from '../console/debug-console-session';
import { observable, action } from 'mobx';
import { TreeNode } from '@ali/ide-core-browser';
import { DebugContribution } from '../debug-contribution';
import { MainLayoutService } from '@ali/ide-main-layout/lib/browser/main-layout.service';

@Injectable()
export class DebugConsoleService {
  @Autowired(DebugConsoleSession)
  protected readonly debugConsole: DebugConsoleSession;

  @Autowired(MainLayoutService)
  protected readonly mainlayoutService: MainLayoutService;

  @observable.shallow
  nodes: any[] = [];

  constructor() {
    this.debugConsole.onDidChange(() => {
      this.updateNodes();
    });
  }

  @action
  updateNodes() {
    this.nodes = this.debugConsole.getChildren();
  }

  get isVisible() {
    const bottomPanelHandler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONSOLE_CONTAINER_ID);
    return bottomPanelHandler.isVisible;
  }

  activate() {
    const bottomPanelHandler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONSOLE_CONTAINER_ID);
    if (bottomPanelHandler && !bottomPanelHandler.isVisible) {
      bottomPanelHandler.activate();
    }
  }

  execute = (value: string) => {
    this.debugConsole.execute(value);
  }
}
