import { ConstructorOf } from '@ali/ide-core-node';
import { ElectronMainModule } from '../electron-main-module';

export interface ElectronAppConfig {

  /**
   * 是否在browser层启用node
   */
  browserNodeIntegrated: boolean;

  /**
   * browser的webPreferences
   */
  webPreferences?: any;

  /**
   * 要加载的模块
   */
  modules: Array<ConstructorOf<ElectronMainModule>>;

  /**
   * node层代码入口
   */
  nodeEntry: string;

  /**
   * browser层代码入口
   */
  browserUrl: string;

  /**
   * 启动时进入的workspace
   */
  startUpWorkspace?: string;

}

export const ElectronAppConfig = Symbol('ElectronAppConfig');
