import * as React from 'react';
import { Injector } from '@ali/common-di';
import { LayoutConfig } from '../bootstrap';
import { ExtensionCandiDate } from '../extension';

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  /**
   * APP的名称
   */
  appName?: string;
  workspaceDir: string;
  coreExtensionDir?: string;
  extensionDir?: string;
  injector: Injector;
  wsPath: string;
  layoutConfig: LayoutConfig;
  /**
   * 用于挂载webview的iframe地址
   */
  webviewEndpoint?: string;
  extWorkerHost?: string;
  extensionCandidate?: ExtensionCandiDate[];
  staticServicePath?: string;

  editorBackgroudImage?: string;
}

export const ConfigContext = React.createContext<AppConfig>({
  workspaceDir: '',
  injector: null as any,
  wsPath: '',
  layoutConfig: {},
  extWorkerHost: '',
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
