import { Autowired } from '@opensumi/di';
import { Domain, ClientAppContribution, Event } from '@opensumi/ide-core-browser';
import { MainLayoutContribution } from '@opensumi/ide-main-layout';
import { IThemeService } from '@opensumi/ide-theme';

import { ITerminalController, ITerminalRestore } from '../../common';
import { IEnvironmentVariableService, EnvironmentVariableServiceToken } from '../../common/environmentVariable';
import { registerTerminalColors } from '../terminal.color';
import { TerminalKeyBoardInputService } from '../terminal.input';

@Domain(ClientAppContribution, MainLayoutContribution)
export class TerminalLifeCycleContribution implements ClientAppContribution, MainLayoutContribution {
  @Autowired()
  protected readonly terminalInput: TerminalKeyBoardInputService;

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITerminalRestore)
  protected readonly store: ITerminalRestore;

  @Autowired(EnvironmentVariableServiceToken)
  protected readonly environmentService: IEnvironmentVariableService;

  @Autowired(IThemeService)
  public readonly themeService: IThemeService;

  initialize() {
    registerTerminalColors();
  }

  onStart() {
    this.terminalInput.listen();
    this.environmentService.initEnvironmentVariableCollections();
  }

  // 必须等待这个事件返回，否则 tabHandler 无法保证获取
  onDidRender() {
    Event.once(this.themeService.onThemeChange)(() => {
      // 主题初始化完成时，恢复终端视图
      this.store.restore().then(() => {
        this.terminalController.firstInitialize();
      });
    });
  }

  onStop() {
    // dispose all task executor
    this.terminalController.disposeTerminalClients({ isTaskExecutor: true });
    this.store.save();
  }
}
