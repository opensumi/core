import { ConstructorOf } from '@opensumi/di';

import { BrowserModule } from '../browser-module';
import { ClientAppContribution } from '../common/common.define';
import { AppConfig } from '../react-providers';

export type ModuleConstructor = ConstructorOf<BrowserModule>;

export type ContributionConstructor = ConstructorOf<ClientAppContribution>;
export type Direction = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';

export interface IconMap {
  [iconKey: string]: string;
}

export interface IPreferences {
  [key: string]: any;
}

export interface IconInfo {
  cssPath: string;
  prefix: string;
  iconMap: IconMap;
}

export interface IClientAppOpts extends Partial<AppConfig> {
  // 模块声明
  modules: ModuleConstructor[];
  // 贡献点声明
  contributions?: ContributionConstructor[];
  // 前端模块实例声明
  modulesInstances?: BrowserModule[];

  // 定义用于 OpenSumi 视图插件内的图标集合
  iconStyleSheets?: IconInfo[];
  /**
   * 是否使用 CDN 版本的图标资源
   * Electron - 默认为 false
   * Web - 默认为 true
   */
  useCdnIcon?: boolean;
  // 插件开发模式下指定的插件路径
  extensionDevelopmentPath?: string | string[];
  /**
   * WebSocket路径和模块的映射配置，用于根据连接路径动态选择加载的模块,没有指定的模块就会走/service
   * 仅支持全匹配
   * 例如：
   * {
   *   "/terminal": ["TerminalModule"],
   * }
   */
  wsPathModuleMapping?: Record<string, ModuleConstructor[]>;
  /**
   * 自定义多个前后端通信路径，用于支持多个WebSocket连接
   */
  connectionPaths?: string[];
}

export interface LayoutConfig {
  [area: string]: {
    modules: Array<string>;
    // @deprecated
    size?: number;
  };
}
