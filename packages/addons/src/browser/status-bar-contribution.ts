import { Autowired } from '@ide-framework/common-di';
import { BrowserConnectionCloseEvent, BrowserConnectionOpenEvent, OnEvent, WithEventBus, CommandService, Domain } from '@ide-framework/ide-core-common';
import { ClientAppContribution } from '@ide-framework/ide-core-browser';

@Domain(ClientAppContribution)
export class StatusBarContribution extends WithEventBus implements ClientAppContribution {
  @Autowired(CommandService)
  private readonly commandService: CommandService;

  onStart() {}

  @OnEvent(BrowserConnectionOpenEvent)
  handleBrowserConnectionOpen() {
    this.commandService.executeCommand('statusbar.changeBackgroundColor', 'var(--statusBar-background)');
  }

  @OnEvent(BrowserConnectionCloseEvent)
  handleBrowserConnectionClose() {
    this.commandService.executeCommand('statusbar.changeBackgroundColor', 'var(--kt-statusbar-offline-background)');
  }
}
