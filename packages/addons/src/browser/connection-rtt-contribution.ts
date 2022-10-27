import { Autowired } from '@opensumi/di';
import { IStatusBarService, StatusBarAlignment, StatusBarEntryAccessor } from '@opensumi/ide-core-browser/lib/services';
import { Command, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common/lib/command';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { ConnectionRTTBrowserServiceToken, ConnectionRTTBrowserService } from './connection-rtt-service';

const START_CONNECTION_RTT_COMMAND: Command = {
  id: 'connection.start.rtt',
  label: '%connection.start.rtt%',
  category: '%command.category.developerTools%',
};

const STOP_CONNECTION_RTT_COMMAND = {
  id: 'connection.stop.rtt',
  label: '%connection.stop.rtt%',
  category: '%command.category.developerTools%',
};

const statusBarOption = {
  alignment: StatusBarAlignment.LEFT,
  priority: Infinity - 1,
};

@Domain(CommandContribution)
export class ConnectionRTTContribution implements CommandContribution {
  @Autowired(IStatusBarService)
  protected readonly statusBarService: IStatusBarService;

  @Autowired(ConnectionRTTBrowserServiceToken)
  protected readonly rttService: ConnectionRTTBrowserService;

  private interval?: NodeJS.Timeout;
  private statusBar?: StatusBarEntryAccessor;

  static INTERVAL = 1000;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(START_CONNECTION_RTT_COMMAND, {
      execute: () => {
        if (!this.interval) {
          this.startRTTInterval();
        }
      },
    });

    commands.registerCommand(STOP_CONNECTION_RTT_COMMAND, {
      execute: () => {
        if (!this.interval) {
          return;
        }
        global.clearInterval(this.interval);
        if (this.statusBar) {
          this.statusBar.dispose();
          this.statusBar = undefined;
        }
      },
    });
  }

  private startRTTInterval() {
    this.interval = global.setInterval(async () => {
      const start = Date.now();
      await this.rttService.measure();
      const rtt = Date.now() - start;

      const option = {
        text: `${rtt}ms`,
      };

      if (!this.statusBar) {
        const element = this.statusBarService.addElement('connection-rtt', {
          ...option,
          ...statusBarOption,
        });
        this.statusBar = element;
      } else {
        this.statusBar.update({ ...option, ...statusBarOption });
      }
    }, ConnectionRTTContribution.INTERVAL);
  }
}
