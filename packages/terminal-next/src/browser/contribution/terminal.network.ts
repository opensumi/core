import { Autowired } from '@ide-framework/common-di';
import { OnEvent, WithEventBus, BrowserConnectionOpenEvent, BrowserConnectionCloseEvent } from '@ide-framework/ide-core-common';
import { Domain, ClientAppContribution } from '@ide-framework/ide-core-browser';
import { ITerminalNetwork, ITerminalInternalService, TerminalNetworkStatus } from '../../common';

@Domain(ClientAppContribution)
export class TerminalNetworkContribution extends WithEventBus implements ClientAppContribution {
  @Autowired(ITerminalNetwork)
  protected readonly network: ITerminalNetwork;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  onStart() {
    this.network.bindErrors();
  }

  @OnEvent(BrowserConnectionOpenEvent)
  handleBrowserConnectionOpen(_e: BrowserConnectionOpenEvent) {
    this.network.setStatus(TerminalNetworkStatus.CONNECTED);
  }

  @OnEvent(BrowserConnectionCloseEvent)
  handleBrowserConnectionClose(_e: BrowserConnectionCloseEvent) {
    this.network.setStatus(TerminalNetworkStatus.DISCONNECTED);
  }
}
