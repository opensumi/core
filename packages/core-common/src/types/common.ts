import { OperatingSystem } from '@opensumi/ide-utils';

export const CommonServerPath = 'CommonServerPath';

export const ICommonServer = Symbol('ICommonServer');

export interface ICommonServer {
  /**
   * 获取后端 OS
   */
  getBackendOS(): Promise<OperatingSystem>;
}

export type UrlProvider = string | (() => string) | (() => Promise<string>);
