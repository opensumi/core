import { Injectable, Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  Domain,
  getIcon,
  IStatusBarService,
  StatusBarAlignment,
  StatusBarEntryAccessor,
} from '@opensumi/ide-core-browser';
import {
  BrowserConnectionCloseEvent,
  BrowserConnectionOpenEvent,
  OnEvent,
  WithEventBus,
} from '@opensumi/ide-core-common';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

@Injectable()
@Domain(ClientAppContribution)
export class StatusBarContribution extends WithEventBus implements ClientAppContribution {
  @Autowired(IIconService)
  private iconService: IconService;

  @Autowired(IStatusBarService)
  private statusBarService: IStatusBarService;

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

  onDidStart() {}
}
