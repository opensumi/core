import { OperatingSystem } from '@opensumi/ide-utils';

export const IApplicationService = Symbol('IApplicationService');

export interface IApplicationService {
  /**
   * In Electron environment, if `isRemote` is not specified, use local connection by default: `electronEnv.metadata.windowClientId`
   * Otherwise, use WebSocket connection: `WSChannelHandler.clientId`
   */
  clientId: string;

  /** 前端 OS */
  frontendOS: OperatingSystem;
  /** 后端 OS */
  backendOS: OperatingSystem;
  /**
   * 获取后端 OS
   */
  getBackendOS(): Promise<OperatingSystem>;
}
