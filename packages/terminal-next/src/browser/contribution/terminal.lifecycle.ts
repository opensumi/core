import { Autowired } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { MainLayoutContribution } from '@opensumi/ide-main-layout';

import { ITerminalController, ITerminalRestore } from '../../common';
import { EnvironmentVariableServiceToken, IEnvironmentVariableService } from '../../common/environmentVariable';
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

  prepare() {
    registerTerminalColors();
  }

  onStart() {
    this.terminalInput.listen();
    this.environmentService.initEnvironmentVariableCollections();
  }

  onDidRender() {
    this.store.restore().then(() => {
      this.terminalController.firstInitialize();
    });
  }

  onStop() {
    // dispose all task executor
    this.terminalController.disposeTerminalClients({ isTaskExecutor: true });
    this.store.save();
  }
}
