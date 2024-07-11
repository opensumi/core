import { Autowired } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import {
  BrowserConnectionCloseEvent,
  BrowserConnectionOpenEvent,
  CommandService,
  Domain,
  ILogger,
  OnEvent,
  WithEventBus,
} from '@opensumi/ide-core-common';

@Domain(ClientAppContribution)
export class StatusBarContribution extends WithEventBus implements ClientAppContribution {
  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  onStart() {}

  @OnEvent(BrowserConnectionOpenEvent)
  handleBrowserConnectionOpen() {
    this.commandService.executeCommand('statusbar.changeBackgroundColor', 'var(--statusBar-background)');
    this.logger.log('Browser connection open, change status bar background color');
  }

  @OnEvent(BrowserConnectionCloseEvent)
  handleBrowserConnectionClose() {
    this.commandService.executeCommand('statusbar.changeBackgroundColor', 'var(--kt-statusbar-offline-background)');
    this.logger.log('Browser connection close, change status bar background color');
  }
}
