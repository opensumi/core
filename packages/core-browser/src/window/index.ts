import { URI } from '@ide-framework/ide-core-common';

export const IWindowService = Symbol('WindowService');

export interface NewWindowOptions {
  readonly external?: boolean;
}

export interface IOpenWorkspaceOption {
  newWindow?: boolean;
}

export interface IWindowService {

  /**
   * 打开新的window窗口
   * @param {string} url
   * @param {NewWindowOptions} [options]
   * @returns {(Window | undefined)}
   * @memberof WindowService
   */
  openNewWindow(url: string, options?: NewWindowOptions): Window | undefined;

  openWorkspace(workspace?: URI,  options?: IOpenWorkspaceOption): void;

  close(): void;

  maximize(): void;

  unmaximize(): void;

  fullscreen(): void;

  minimize(): void;
}
