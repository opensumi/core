import { ConstructorOf } from '@opensumi/di';
import { ApplicationConfig, UrlProvider } from '@opensumi/ide-core-common';

import { BrowserModule } from '../browser-module';
import { ClientAppContribution } from '../common/common.define';

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

export interface IClientAppOpts extends Partial<ApplicationConfig> {
  modules: ModuleConstructor[];
  contributions?: ContributionConstructor[];
  modulesInstances?: BrowserModule[];
  connectionPath?: UrlProvider;
  connectionProtocols?: string[];
  iconStyleSheets?: IconInfo[];
  useCdnIcon?: boolean;
  editorBackgroundImage?: string;
  /**
   * 插件开发模式下指定的插件路径
   */
  extensionDevelopmentPath?: string | string[];
}

export interface LayoutConfig {
  [area: string]: {
    modules: Array<string>;
    // @deprecated
    size?: number;
  };
}
