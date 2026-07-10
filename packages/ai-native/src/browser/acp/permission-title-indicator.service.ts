import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, ClientAppContribution, Disposable, Domain } from '@opensumi/ide-core-browser';

import { AIPanelLayoutService } from '../layout/panel-layout.service';

import { AcpPermissionBridgeService } from './permission-bridge.service';

const PERMISSION_TITLE_PREFIX = /^\(\d+\) permission\s+/;

@Injectable()
@Domain(ClientAppContribution)
export class AcpPermissionTitleIndicatorService extends Disposable implements ClientAppContribution {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(AcpPermissionBridgeService)
  private readonly permissionBridgeService: AcpPermissionBridgeService;

  @Autowired(AIPanelLayoutService)
  private readonly panelLayoutService: AIPanelLayoutService;

  private initialized = false;
  private indicatorApplied = false;
  private baseTitle = '';

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (this.appConfig.isElectronRenderer || typeof document === 'undefined') {
      return;
    }

    this.baseTitle = this.stripPermissionIndicator(document.title);

    this.addDispose(this.permissionBridgeService.onPendingCountChange(() => this.updateTitle()));
    this.addDispose(this.panelLayoutService.onDidChangePanelLayout(() => this.updateTitle()));
    this.updateTitle();
  }

  dispose(): void {
    this.restoreTitle();
    super.dispose();
  }

  private updateTitle(): void {
    if (this.appConfig.isElectronRenderer || typeof document === 'undefined') {
      return;
    }

    const pendingCount = this.permissionBridgeService.getPendingCount();
    const shouldShowIndicator = this.panelLayoutService.getLayoutMode() === 'agentic' && pendingCount > 0;

    if (!this.indicatorApplied) {
      this.baseTitle = this.stripPermissionIndicator(document.title);
    }

    if (shouldShowIndicator) {
      document.title = `(${pendingCount}) permission ${this.baseTitle}`;
      this.indicatorApplied = true;
      return;
    }

    this.restoreTitle();
  }

  private restoreTitle(): void {
    if (!this.indicatorApplied || typeof document === 'undefined') {
      return;
    }

    document.title = this.baseTitle;
    this.indicatorApplied = false;
  }

  private stripPermissionIndicator(title: string): string {
    return title.replace(PERMISSION_TITLE_PREFIX, '');
  }
}
