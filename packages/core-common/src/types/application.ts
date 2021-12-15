import { OS } from '../utils';

export const IApplicationService = Symbol('IApplicationService');

export interface IApplicationService {
  /** 前端 OS */
  frontendOS: OS.Type;
  /** 后端 OS */
  backendOS: OS.Type;
  /**
   * 获取后端 OS
   */
  getBackendOS(): Promise<OS.Type>;
}
