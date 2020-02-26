import * as React from 'react';
import { Injector } from '@ali/common-di';
import { ExtensionCandiDate } from '@ali/ide-core-common';
import { LayoutConfig } from '../bootstrap';

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  /**
   * APP的名称
   */
  appName?: string;
  workspaceDir: string;
  coreExtensionDir?: string;
  extensionDir?: string;
  /**
   * 设置全局存储的文件夹名称
   * 默认值为 .kaitian
   */
  storageDirName?: string;
  /**
   * 设置工作区配置文件的文件夹名称
   * 默认值为 .kaitian
   */
  preferenceDirName?: string;
  /**
   * 全局插件数据存储目录名称，默认 .kaitian
   */
  extensionStorageDirName?: string;
  injector: Injector;
  wsPath: string;
  layoutConfig: LayoutConfig;
  layoutComponent?: React.FC;
  /**
   * 用于挂载webview的iframe地址
   */
  webviewEndpoint?: string;
  extWorkerHost?: string;
  extensionCandidate?: ExtensionCandiDate[];
  staticServicePath?: string;

  editorBackgroudImage?: string;

  isSyncPreference?: boolean;

  useExperimentalMultiChannel?: boolean;
  /**
   * 自定义客户端 id，是 websocket 服务的唯一标识
   * 也是传给声明了 backServices 的后端 Service 的唯一标识
   * 注意保持这个 id 的唯一性
   */
  clientId?: string;
  // 是否禁用插件进程
  noExtHost?: boolean;
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
