import { Injectable, Autowired } from '@opensumi/di';
import { ClientAppContribution, Domain, IStatusBarService, StatusBarAlignment, StatusBarEntryAccessor } from '@opensumi/ide-core-browser';
import { BrowserConnectionCloseEvent, BrowserConnectionOpenEvent, OnEvent, WithEventBus } from '@opensumi/ide-core-common';
import { IconType } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

@Injectable()
@Domain(ClientAppContribution)
export class StatusBarContribution extends WithEventBus implements ClientAppContribution {

  @Autowired(IconService)
  private iconService: IconService;

  @Autowired(IStatusBarService)
  private statusBarService: IStatusBarService;

  private statusBarElement?: StatusBarEntryAccessor;

  private onDidConnectionChange(
    text: string | undefined,
    backgroundColor: string,
  ) {
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

  onDidStart() {
    if (!this.statusBarElement) {
      this.statusBarElement = this.statusBarService.addElement('OpenSumi', {
        backgroundColor: 'var(--button-background)',
        color: '#FFFFFF',
        tooltip: 'OpenSumi',
        alignment: StatusBarAlignment.LEFT,
        iconClass: this.iconService.fromIcon('', 'https://img.alicdn.com/imgextra/i1/O1CN01I0fKZ51PTgHByjznG_!!6000000001842-2-tps-40-40.png', IconType.Mask),
        priority: Infinity,
      });
    }
  }

}
