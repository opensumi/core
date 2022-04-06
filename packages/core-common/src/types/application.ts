import { OperatingSystem } from '@opensumi/ide-utils';

export const IApplicationService = Symbol('IApplicationService');

export interface IApplicationService {
  /** 前端 OS */
  frontendOS: OperatingSystem;
  /** 后端 OS */
  backendOS: OperatingSystem;
  /**
   * 获取后端 OS
   */
  getBackendOS(): Promise<OperatingSystem>;
}
