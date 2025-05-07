import { Autowired, Injectable } from '@opensumi/di';
import {
  ClientAppContribution,
  Domain,
  IStatusBarService,
  StatusBarAlignment,
  StatusBarEntryAccessor,
  getIcon,
} from '@opensumi/ide-core-browser';
import {
  BrowserConnectionCloseEvent,
  BrowserConnectionOpenEvent,
  CommandContribution,
  CommandRegistry,
  CommandService,
  OnEvent,
  Uri,
  WithEventBus,
} from '@opensumi/ide-core-common';
import { MULTI_DIFF_SCHEME } from '@opensumi/ide-editor/lib/common/multi-diff';

let executeCount = 0;

const TEST_MULTI_DIFF_COMMAND = 'testMultiDiffCommand';

@Injectable()
@Domain(ClientAppContribution, CommandContribution)
export class StatusBarContribution extends WithEventBus implements ClientAppContribution, CommandContribution {
  @Autowired(IStatusBarService)
  private statusBarService: IStatusBarService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  private statusBarElement?: StatusBarEntryAccessor;

  private onDidConnectionChange(text: string | undefined, backgroundColor: string) {
    if (this.statusBarElement) {
      this.statusBarElement.update({
        text,
        backgroundColor,
        alignment: StatusBarAlignment.LEFT,
      });
    }
  }

  @OnEvent(BrowserConnectionCloseEvent)
  onDidDisConnect() {
    this.onDidConnectionChange('Disconnected', 'var(--kt-statusbar-offline-background)');
  }

  @OnEvent(BrowserConnectionOpenEvent)
  onDidConnected() {
    this.onDidConnectionChange(undefined, 'var(--button-background)');
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(
      { id: TEST_MULTI_DIFF_COMMAND },
      {
        execute: () => this.openDiff(),
      },
    );
  }

  private openDiff() {
    this.commandService.executeCommand('_workbench.openMultiDiffEditor', {
      title: 'compareTitle',
      multiDiffSourceUri: Uri.parse(`${MULTI_DIFF_SCHEME}://test`),
      resources: [
        {
          // NOTE: 仅用于演示用法，请修改成你本机的文件路径
          originalUri: Uri.file('/Users/louis/ide/opensumi/jest.setup.node.js'),
          modifiedUri: Uri.file('/Users/louis/ide/opensumi/jest.setup.jsdom.js'),
        },
      ].concat(
        executeCount++ === 0
          ? []
          : [
              {
                originalUri: Uri.file('/Users/louis/ide/opensumi/packages/startup/webpack.lite.config.js'),
                modifiedUri: Uri.file('/Users/louis/ide/opensumi/packages/startup/webpack.preview.config.js'),
              },
            ],
      ),
    });
  }

  onDidStart() {
    if (!this.statusBarElement) {
      this.statusBarElement = this.statusBarService.addElement('OpenSumi', {
        backgroundColor: 'var(--button-background)',
        color: 'var(--button-foreground)',
        tooltip: 'OpenSumi',
        alignment: StatusBarAlignment.LEFT,
        iconClass: getIcon('code'),
        priority: Infinity,
      });
      this.statusBarService.addElement('OpenSumi', {
        tooltip: 'Test MultiDiff Logic, Press twice will open multi-diff editor with two files',
        alignment: StatusBarAlignment.LEFT,
        text: 'MultiDiff Test',
        priority: 10,
        command: TEST_MULTI_DIFF_COMMAND,
      });
    }
  }
}
