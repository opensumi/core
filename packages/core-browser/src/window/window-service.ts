import { Injectable, Autowired } from '@ali/common-di';

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
}

@Injectable()
export class WindowServiceImpl implements WindowService {
  openNewWindow(url: string): Window | undefined {
    const newWindow = window.open(url);
    if (newWindow === null) {
      throw new Error('Cannot open a new window for URL: ' + url);
    }
    return newWindow;
  }
}
