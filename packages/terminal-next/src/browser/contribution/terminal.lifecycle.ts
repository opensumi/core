import { Autowired } from '@ali/common-di';
import { Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { MainLayoutContribution } from '@ali/ide-main-layout';
import { ITerminalController, ITerminalRestore } from '../../common';
import { TerminalKeyBoardInputService } from '../terminal.input';

@Domain(ClientAppContribution, MainLayoutContribution)
export class TerminalLifeCycleContribution implements ClientAppContribution, MainLayoutContribution {
  @Autowired()
  protected readonly terminalInput: TerminalKeyBoardInputService;

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITerminalRestore)
  protected readonly store: ITerminalRestore;

  onStart() {
    this.terminalInput.listen();
  }

  // 必须等待这个事件返回，否则 tabHandler 无法保证获取
  onDidRender() {
    this.store.restore()
      .then(() => {
        this.terminalController.firstInitialize();
      });
  }

  onStop() {
    this.store.save();
  }
}
