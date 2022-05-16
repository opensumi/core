import { Autowired } from '@opensumi/di';
import { Domain, ClientAppContribution } from '@opensumi/ide-core-browser';
import { MainLayoutContribution } from '@opensumi/ide-main-layout';

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

  initialize() {
    registerTerminalColors();
  }

  onStart() {
    this.terminalInput.listen();
    this.environmentService.initEnvironmentVariableCollections();
  }

  // 必须等待这个事件返回，否则 tabHandler 无法保证获取
  onDidRender() {
    this.store.restore().then(() => {
      this.terminalController.firstInitialize();
    });
  }

  onStop() {
    this.store.save();
  }
}
