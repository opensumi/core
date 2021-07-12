import * as React from 'react';
import { Injector } from '@ali/common-di';
import { ExtensionCandidate, ExtensionConnectOption } from '@ali/ide-core-common';
import { IPreferences, LayoutConfig } from '../bootstrap';

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  /**
   * APP的名称
   * 默认值为 `ClientApp.DEFAULT_APPLICATION_NAME` 即 `KAITIAN`
   */
  appName?: string;
  /**
   * 默认内部的 uriScheme，用于桌面版 app 的唤起
   * 同时也默认为 vscode.env.uriScheme 的值
   * 默认值为 `ClientApp.DEFAULT_URI_SCHEME` 即 `kaitian`
   */
  uriScheme?: string;
  /**
   * 打开的工作区路径
   */
  workspaceDir: string;
  /**
   * 插件目录路径
   */
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
   * 更精细的项目工作区配置存储位置
   * 即当 preferenceDirName = '.kaitian' ， workspacePreferenceDirName = '.o2'时，
   * 对应全局配置为 ~/.kaitian/settings.json , 工作区配置为 {workspaceDir}/.o2/settings.json
   */
  workspacePreferenceDirName?: string;
  /**
   * 更精细的项目用户配置存储位置
   * 即当 preferenceDirName = '.kaitian' ， userPreferenceDirName = '.o2'时，
   * 对应全局配置为 ~/.kaitian/settings.json , 工作区配置为 {userDir}/.o2/settings.json
   */
  userPreferenceDirName?: string;
  /**
   * 全局插件数据存储目录名称，默认 .kaitian
   */
  extensionStorageDirName?: string;
  /**
   * 默认配置
   */
  defaultPreferences?: IPreferences;
  /**
   * DI Handler
   */
  injector: Injector;
  /**
   * ws 通信路径
   */
  wsPath: string;
  /**
   * 布局配置
   */
  layoutConfig: LayoutConfig;
  layoutComponent?: React.FC;
  /**
   * 面板大小，宽度/高度
   */
  panelSizes?: {[slotLocation: string]: number};
  /**
   * 默认面板
   */
  defaultPanels?: {[slotLocation: string]: string};
  /**
   * 用于挂载webview的iframe地址
   */
  webviewEndpoint?: string;
  extWorkerHost?: string;
  /**
   * 额外指定的插件路径，一般用于内置插件
   */
  extensionCandidate?: ExtensionCandidate[];
  staticServicePath?: string;

  extensionDevelopmentHost?: boolean;

  editorBackgroundImage?: string;

  isSyncPreference?: boolean;

  useExperimentalMultiChannel?: boolean;
  /**
   * 用于插件 UI 部分开启实验性 ShadowDOM
   */
  useExperimentalShadowDom?: boolean;
  /**
   * 加载 workerHost 时使用 iframe 包装
   * 对于跨域的场景，加载 workerHost 时会使用 base64 编码后通过 importScripts 引入(importScripts 不受跨域限制)
   * 但这会导致 workerHost 的 origin 为 null，使某些请求失败
   */
  useIframeWrapWorkerHost?: boolean;

  /**
   * 自定义客户端 id，是 websocket 服务的唯一标识
   * 也是传给声明了 backServices 的后端 Service 的唯一标识
   * 注意保持这个 id 的唯一性
   */
  clientId?: string;
  // 是否禁用插件进程
  noExtHost?: boolean;

  /**
   * @ClientOption
   * 额外的 ConfigProvider
   * 可以让 IDE-framework 内部的 ReactDOM.render 调用时
   * 都被其包裹一层，以达到额外的 context 传递效果
   */
  extraContextProvider?: React.ComponentType<React.PropsWithChildren<any>>;

  /**
   * @ClientOption
   * @default true
   * 允许按照 workspace dir 去动态设置 document#title, 默认为 true
   */
  allowSetDocumentTitleFollowWorkspaceDir?: boolean;
  /**
   * @ClientOption
   * 远程访问地址，可以通过该地址访问当容器服务
   * 默认为 window.location.hostname
   */
  remoteHostname?: string;
  /**
   * 开启插件进程的 Debug
  */
  enableDebugExtensionHost?: boolean;

  /**
   * 加载插件前端资源时的 fetch credentials 选项
   * 可选项为 "include" | "omit" | "same-origin"
   */
  extensionFetchCredentials?: RequestCredentials;
  /**
   * 插件进程连接时候一些配置选项
   */
  extensionConnectOption?: ExtensionConnectOption;

  /**
   * 当 DOM 首次渲染完成后调用
   * 此时表示 IDE 界面已经完成渲染并可以操作
   */
  didRendered?: () => void;
}

export const ConfigContext = React.createContext<AppConfig>({
  workspaceDir: '',
  injector: null as any,
  wsPath: '',
  layoutConfig: {},
  extWorkerHost: '',
});

export function ConfigProvider(props: React.PropsWithChildren<{ value: AppConfig }>) {
  const { extraContextProvider, ...restPropsValue } = props.value;
  const app = (
    <ConfigContext.Provider value={restPropsValue}>
      <ConfigContext.Consumer>
        { (value) => restPropsValue === value ? props.children : null }
      </ConfigContext.Consumer>
    </ConfigContext.Provider>
  );

  if (!extraContextProvider) {
    return app;
  }

  return React.createElement(extraContextProvider, { children: app });
}
