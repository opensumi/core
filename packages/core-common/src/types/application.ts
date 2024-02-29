import { OperatingSystem } from '@opensumi/ide-utils';

export const IApplicationService = Symbol('IApplicationService');

export interface IApplicationService {
  /**
   * equals to `WSChannelHandler.clientId`, which will be inited when create connection to backend
   */
  clientId: string;
  /**
   * maybe for historical reasons, there are two `xxId` in whole codebase.
   *
   * this property is not the same as `clientId` in Electron environment.
   * clientId has a prefix `CODE_WINDOW_CLIENT_ID:` and windowId is a number in Electron environment.
   */
  windowId: string | number;

  frontendOS: OperatingSystem;
  backendOS: OperatingSystem;
  getBackendOS(): Promise<OperatingSystem>;
}
