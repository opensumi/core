import * as React from 'react';
import { Injector } from '@ali/common-di';
import { LayoutConfig } from '../bootstrap';

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  workspaceDir: string;
  coreExtensionDir?: string;
  extensionDir?: string; // TODO 将插件目录数据移到node层，需要资源服务修改
  injector: Injector;
  wsPath: string;
  layoutConfig: LayoutConfig;

  /**
   * 用于挂载webview的iframe地址
   */
  webviewEndpoint?: string;
}

export const ConfigContext = React.createContext<AppConfig>({
  workspaceDir: '',
  injector: null as any,
  wsPath: '',
  layoutConfig: {},
});

export function ConfigProvider(props: React.PropsWithChildren<{ value: AppConfig }>) {
  return (
    <ConfigContext.Provider value={ props.value }>
      <ConfigContext.Consumer>
        { (value) => props.value === value ? props.children : null }
      </ConfigContext.Consumer>
    </ConfigContext.Provider>
  );
}
