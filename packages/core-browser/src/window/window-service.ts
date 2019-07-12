import { Injectable, Autowired } from '@ali/common-di';
import { CorePreferences } from '../core-preferences';
import { ContributionProvider } from '@ali/ide-core-common';
import { ClientApp } from '../bootstrap/app';
import { ClientAppContribution } from '../common';

export interface NewWindowOptions {
  readonly external?: boolean;
}

export const WindowService = Symbol('WindowService');
export interface WindowService {
  /**
   * 打开新的window窗口
   * @param {string} url
   * @param {NewWindowOptions} [options]
   * @returns {(Window | undefined)}
   * @memberof WindowService
   */
  openNewWindow(url: string, options?: NewWindowOptions): Window | undefined;

  /**
   * 当 `window` 在 `unload` 事件触发时
   * 参考 [`BeforeUnloadEvent`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
   * @returns {boolean}
   * @memberof WindowService
   */
  canUnload(): boolean;

  /**
   * 设置应用名称
   * @param {ClientApp} app
   * @memberof WindowService
   */
  setApplication(app: ClientApp): void;
}

@Injectable()
export class WindowServiceImpl implements WindowService {

  protected frontendApplication: ClientApp;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  @Autowired(ClientAppContribution)
  protected readonly appContributions: ContributionProvider<ClientAppContribution>;

  setApplication(app: ClientApp): void {
    this.frontendApplication = app;
  }

  openNewWindow(url: string): Window | undefined {
    const newWindow = window.open(url);
    if (newWindow === null) {
      throw new Error('Cannot open a new window for URL: ' + url);
    }
    return newWindow;
  }

  canUnload(): boolean {
    const confirmExit = this.corePreferences['application.confirmExit'];
    if (confirmExit === 'never') {
      return true;
    }
    for (const contribution of this.appContributions.getContributions()) {
      if (contribution.onWillStop) {
        if (!!contribution.onWillStop(this.frontendApplication)) {
          return false;
        }
      }
    }
    return confirmExit !== 'always';
  }

}
