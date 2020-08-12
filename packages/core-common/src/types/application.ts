import { OS } from '../utils';

export const IApplicationService = Symbol('IApplicationService');

export interface IApplicationService {
  /**
   * 获取后端 OS
   */
  getBackendOS(): Promise<OS.Type>;
}

