import React from 'react';

import type { Injector } from '@opensumi/di';
import type {
  ExtensionBrowserStyleSheet,
  ExtensionCandidate,
  ExtensionConnectOption,
  UrlProvider,
} from '@opensumi/ide-core-common';

import type { IPreferences, LayoutConfig } from '../bootstrap';

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  /**
   * APP的名称
   * 默认值为 `ClientApp.DEFAULT_APPLICATION_NAME` 即 `OPENSUMI`
   */
  appName?: string;
  /**
   * 应用程序的托管位置
   * 默认桌面端下为 `desktop`, Web 下为 `web`
   * 可以传入自定义的名称
   */
  appHost?: string;
  /**
   * 应用绝对安装路径
   *
   * 部分插件，如 `typescript-vue-language-features` 可能会基于该路径获取相关依赖地址
   * refs: https://github.com/search?q=getVscodeTypescriptPath&type=code
   *
   * 注意: 在没有应用绝对安装路径的环境中运行时，该值是空字符
   */
  appRoot?: string;
  /**
   * 默认内部的 uriScheme，用于桌面版 app 的唤起
   * 同时也默认为 vscode.env.uriScheme 的值
   * 默认值为 `ClientApp.DEFAULT_URI_SCHEME` 即 `sumi`
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
   * 默认值为 .sumi
   */
  storageDirName?: string;
  /**
   * 设置工作区配置文件的文件夹名称
   * 默认值为 .sumi
   */
  preferenceDirName?: string;
  /**
   * 更精细的项目工作区配置存储位置
   * 即当 preferenceDirName = '.sumi' ， workspacePreferenceDirName = '.o2'时，
   * 对应全局配置为 ~/.sumi/settings.json , 工作区配置为 {workspaceDir}/.o2/settings.json
   */
  workspacePreferenceDirName?: string;
  /**
   * 更精细的项目用户配置存储位置
   * 即当 preferenceDirName = '.sumi' ， userPreferenceDirName = '.o2'时，
   * 对应全局配置为 ~/.sumi/settings.json , 工作区配置为 {userDir}/.o2/settings.json
   */
  userPreferenceDirName?: string;
  /**
   * 全局插件数据存储目录名称，默认 .sumi
   */
  extensionStorageDirName?: string;
  /**
   * 默认配置
   */
  defaultPreferences?: IPreferences;
  /**
   * 初始化的 DI 实例，一般可在外部进行 DI 初始化之后传入，便于提前进行一些依赖的初始化
   */
  injector: Injector;
  /**
   * 定义 WebScoket 通信路径
   */
  wsPath: UrlProvider;
  /**
   * 定义 IDE 各个布局区块默认加载的模块，可针对性对模块进行增删改
   * 默认值可参考：https://github.com/opensumi/core/tree/58b998d9e1f721928f576579f16ded46b7505e84/packages/main-layout/src/browser/default-config.ts
   */
  layoutConfig: LayoutConfig;
  /**
   * 定义 IDE 的整体布局，可以通过传入自定义布局的方式定义各个区块的默认大小及缩放选项等
   * 默认值可参考：https://github.com/opensumi/core/blob/58b998d9e1f721928f576579f16ded46b7505e84/packages/core-browser/src/components/layout/default-layout.tsx
   */
  layoutComponent?: React.FC;
  /**
   * 可基于 `layoutComponent` 配置的基础上
   * 定义面板大小，宽度/高度
   */
  panelSizes?: { [slotLocation: string]: number };
  /**
   * 定义各个区块的默认面板
   * 如：{ [SlotLocation.bottom]: '@opensumi/ide-terminal-next' }
   * 定义了底部区块默认使用 `@opensumi/ide-terminal-next` 模块进行初始化
   */
  defaultPanels?: { [slotLocation: string]: string };
  /**
   * 用于挂载webview的iframe地址
   * 默认值：`http://${deviceIp}:${port}/webview`,
   */
  webviewEndpoint?: string;
  /**
   * Worker 插件的默认启动路径
   * 默认值为: https://dev.g.alicdn.com/tao-ide/ide-lite/${version}/worker-host.js
   */
  extWorkerHost?: string;
  /**
   * 额外指定的插件路径，一般用于内置插件
   */
  extensionCandidate?: ExtensionCandidate[];
  /**
   * 定义静态资源的加载路径
   * 默认值为：`http://${HOST}:8000/assets/${path}`
   */
  staticServicePath?: string;
  /**
   * 定义是否以插件开发模式启动
   */
  extensionDevelopmentHost?: boolean;
  /**
   * 定义编辑器默认背景图片
   */
  editorBackgroundImage?: string;
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
   * 忽略 Worker Host 可能出现的跨域问题
   */
  ignoreWorkerHostCors?: boolean;
  /**
   * 自定义客户端 id，是 websocket 服务的唯一标识
   * 也是传给声明了 backServices 的后端 Service 的唯一标识
   * 注意保持这个 id 的唯一性
   */
  clientId?: string;
  /**
   * 是否禁用插件进程
   */
  noExtHost?: boolean;
  /**
   * @ClientOption
   * 额外的 ConfigProvider
   * 可以让 OpenSumi 内部的 ReactDOM.render 调用时
   * 都被其包裹一层，以达到额外的 context 传递效果
   */
  extraContextProvider?: React.ComponentType<React.PropsWithChildren<any>>;
  /**
   * @ClientOption
   * @default true
   * 允许按照工作区路径去动态设置 document#title, 默认为 true
   */
  allowSetDocumentTitleFollowWorkspaceDir?: boolean;
  /**
   * @ClientOption
   * 远程访问地址，可以通过该地址访问当容器服务
   * 默认为 window.location.hostname
   */
  remoteHostname?: string;
  /**
   * 开启插件进程的调试能力，默认为 false
   */
  enableDebugExtensionHost?: boolean;
  /**
   * 调试插件进程时的 inspect host 地址,
   * 需要开启 `enableDebugExtensionHost` 配置才能生效
   */
  inspectExtensionHost?: string;
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
  /**
   * @deprecated
   * vscode-oniguruma-wasm 资源地址，在 Windows 版本中很容易传送错误的地址，请使用 onigWasmUri 参数
   */
  onigWasmPath?: string;
  /**
   * vscode-oniguruma-wasm 资源 Uri 地址
   */
  onigWasmUri?: string;
  /**
   * 工作区文件后缀，默认后缀为 `sumi-workspace`
   */
  workspaceSuffixName?: string;
  /**
   * 视图组件内默认的组件样式资源 CDN 来源
   * 默认值为 'alipay'
   */
  componentCDNType?: TComponentCDNType;
  /**
   * 指定前端是否为 Electron 环境 (Electron Renderer)
   * 为兼容老的逻辑，若不兼容则 fallback 到 isElectronRenderer 的判断
   * 新版本中建议优先使用 isElectronRenderer
   */
  isElectronRenderer: boolean;
  /**
   * 指定当前是否通过 remote 模式连接到远程的 Server 端
   * 这将影响 Terminal 与 Extension 模块与子进程的连接方式
   */
  isRemote?: boolean;
  /**
   * 是否开启对 OpenSumi DevTools 的支持
   * 默认值为 false
   */
  devtools?: boolean;
  /**
   * 配置插件 browser 层的 component 样式文件和 iconfont 样式文件
   */
  extensionBrowserStyleSheet?: ExtensionBrowserStyleSheet;
  /**
   * 是否采用工作区内的 `.vscode` 配置作为项目启动的配置默认值
   * 该配置默认值仅在首次启动时进行同步，后续的更改将不会带来任何效果，即框架本身将不监听 `.vscode` 内的文件变化
   */
  useVSCodeWorkspaceConfiguration?: boolean;
  /*
   * 定义协同模块的通信路径
   * 需要带端口号, 默认是 12345，可使用 COLLABORATION_PORT 字段来指定
   */
  collaborationWsPath?: string;
  /**
   * control rpcProtocol message timeout
   * default -1，it means disable
   */
  rpcMessageTimeout?: number;
}

export const ConfigContext = React.createContext<AppConfig>({
  workspaceDir: '',
  injector: null as any,
  wsPath: '',
  layoutConfig: {},
  extWorkerHost: '',
  isElectronRenderer: false,
});

export function ConfigProvider(props: React.PropsWithChildren<{ value: AppConfig }>) {
  const { extraContextProvider, ...restPropsValue } = props.value;
  const app = (
    <ConfigContext.Provider value={restPropsValue}>
      <ConfigContext.Consumer>{(value) => (restPropsValue === value ? props.children : null)}</ConfigContext.Consumer>
    </ConfigContext.Provider>
  );

  if (!extraContextProvider) {
    return app;
  }

  return React.createElement(extraContextProvider, { children: app });
}

export type TComponentCDNType = 'unpkg' | 'jsdelivr' | 'alipay' | 'npmmirror';
