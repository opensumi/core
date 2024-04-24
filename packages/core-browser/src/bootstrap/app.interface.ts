import { ConstructorOf } from '@opensumi/di';
import { UrlProvider } from '@opensumi/ide-core-common';

import { BrowserModule } from '../browser-module';
import { ClientAppContribution } from '../common/common.define';
import { ILayoutViewSize } from '../layout/constants';
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
  // 自定义前后端通信路径
  connectionPath?: UrlProvider;
  // 支持的通信协议类型
  connectionProtocols?: string[];
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
   * Define the default size (height) of each layout block in the IDE
   */
  layoutViewSize?: Partial<ILayoutViewSize>;
}

export interface LayoutConfig {
  [area: string]: {
    modules: Array<string>;
    // @deprecated
    size?: number;
  };
}
