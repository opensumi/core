import { Autowired, Injectable } from '@opensumi/di';
import { IStatusBarService, StatusBarAlignment, StatusBarEntryAccessor } from '@opensumi/ide-core-browser/lib/services';
import { CommandContribution, CommandRegistry } from '@opensumi/ide-core-common/lib/command';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import { localize } from '@opensumi/ide-core-common/lib/localize';

import { ConnectionBackServicePath, IConnectionBackService } from '../common';

const START_CONNECTION_RTT_COMMAND = {
  id: 'connection.start.rtt',
  label: localize('connection.start.rtt', '开发人员工具：查看通信延迟'),
};

const STOP_CONNECTION_RTT_COMMAND = {
  id: 'connection.stop.rtt',
  label: localize('connection.stop.rtt', '开发人员工具：关闭通信延迟检查'),
};

const statusBarOption = {
  alignment: StatusBarAlignment.LEFT,
  priority: Infinity - 1,
};

export const ConnectionRTTBrowserServiceToken = Symbol('ConnectionRTTBrowserService');

@Injectable()
export class ConnectionRTTBrowserService {
  @Autowired(ConnectionBackServicePath)
  protected readonly connectionBackService: IConnectionBackService;

  async measure() {
    await this.connectionBackService.$measure();
  }
}

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
