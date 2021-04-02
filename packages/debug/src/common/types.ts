import { IJSONSchemaSnippet } from '@ali/ide-core-common';

export interface IPlatformSpecificAdapterContribution {
  program?: string;
  args?: string[];
  runtime?: string;
  runtimeArgs?: string[];
}

export interface IDebuggerContribution extends IPlatformSpecificAdapterContribution {
  type: string;
  label?: string;
  // debug adapter executable
  adapterExecutableCommand?: string;
  win?: IPlatformSpecificAdapterContribution;
  winx86?: IPlatformSpecificAdapterContribution;
  windows?: IPlatformSpecificAdapterContribution;
  osx?: IPlatformSpecificAdapterContribution;
  linux?: IPlatformSpecificAdapterContribution;

  // internal
  aiKey?: string;

  // supported languages
  languages?: string[];
  enableBreakpointsFor?: { languageIds: string[] };

  // debug configuration support
  configurationAttributes?: any;
  initialConfigurations?: any[];
  configurationSnippets?: IJSONSchemaSnippet[];
  variables?: { [key: string]: string };
}

export enum DEBUG_REPORT_NAME {

  /**
   * 启动调试响应耗时
   */
  DEBUG_SESSION_START_TIME = 'debugSessionStartTime',
  /**
   * preLaunchTask 耗时
   */
  DEBUG_PRE_LAUNCH_TASK_TIME = 'debugPreLaunchTaskTime',
  /**
   * 工具栏各操作响应耗时
   */
  DEBUG_TOOLBAR_OPERATION_TIME = 'debugToolBarOperationTime',
  /**
   * 工具栏各操作点击
   */
  DEBUG_TOOLBAR_OPERATION = 'debugToolBarOperation',
  /**
   * 左侧所有面板展开收起点击
   */
  DEBUG_PANEL_OPERATION_FOLDEXPR = 'debugPanelOperationFoldexpr',
  /**
   * 监听
   */
  DEBUG_WATCH = 'debugWatch',
  /**
   * 变量
   */
  DEBUG_VARIABLES = 'debugVariables',
  /**
   * 断点
   */
  DEBUG_BREAKPOINT = 'debugBreakpoint',
  /**
   * DAP 请求和响应耗时
   */
  DEBUG_ADAPTER_PROTOCOL_TIME = 'debugAdapterProtocolTime',
  /**
   * 断点命中
   */
  DEBUG_STOPPED = 'debugStopped',
  /**
   * 前端 UI 渲染层耗时
   */
  DEBUG_UI_FRONTEND_TIME = 'debugFrontEndTime',
}
