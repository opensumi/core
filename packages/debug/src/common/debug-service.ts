import { IDisposable, IJSONSchema, IJSONSchemaSnippet, ApplicationError, Event } from '@opensumi/ide-core-common';

import { DebugConfiguration } from './debug-configuration';
import { IDebugSessionDTO } from './debug-session-options';

export interface DebuggerDescription {
  type: string;
  label: string;
}

export const DebugAdapterPath = 'DebugAdaptor';

// Browser DI Token
export const IDebugServer = Symbol('DebugServer');

export interface DebugServer extends IDisposable {
  /**
   * 查找并返回注册了的Debug类型
   * @returns Debug 类型数组
   */
  debugTypes(): Promise<string[]>;

  /**
   * 根据语言获取对应的Debuggers
   * @param language
   */
  getDebuggersForLanguage(language: string): Promise<DebuggerDescription[]>;

  /**
   * 根据调试类型获取支持的Schema
   * @param debugType 调试类型
   */
  getSchemaAttributes(debugType: string): Promise<IJSONSchema[]>;

  /**
   * 根据调试类型获取对应的片段
   */
  getConfigurationSnippets(): Promise<IJSONSchemaSnippet[]>;

  /**
   * 提供对应调试类型下的配置
   * @param debugType 调试类型
   */
  provideDebugConfigurations(debugType: string, workspaceFolderUri: string | undefined): Promise<DebugConfiguration[]>;

  /**
   * 处理调试配置，补全缺省值
   * @param config 需要处理的配置
   * @param workspaceFolderUri 工作区目录路径
   */
  resolveDebugConfiguration(
    config: DebugConfiguration,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration | undefined | null>;

  /**
   * 进一步处理调试配置，通过补全缺省值的方式
   * 具体实现通过插件进行二次实现
   * @param {DebugConfiguration} 处理的配置
   * @param {(string | undefined)} 工作区路径
   */
  resolveDebugConfigurationWithSubstitutedVariables(
    config: DebugConfiguration,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration | undefined | null>;
  /**
   * 创建一个新的DebugAdapterSession进程
   * @param config 传入配置
   * @returns DebugAdapterSession对应sessionId.
   */
  createDebugSession(config: IDebugSessionDTO): Promise<string | void>;

  /**
   * 终止一个调试进程
   * @param sessionId
   */
  terminateDebugSession(sessionId: string): Promise<void>;
}

export const IDebugService = Symbol('DebugService');

export interface IDebugService {
  onDidDebugContributionPointChange: Event<IDebugServiceContributionPoint>;
  unregisterDebugContributionPoints(extensionFolder: string): void;
  registerDebugContributionPoints(extensionFolder: string, contributions: IJSONSchema[]): void;
  debugContributionPoints: Map<string, IJSONSchema[]>;
}

export interface IDebugServiceContributionPoint {
  path: string;
  contributions: IJSONSchema[];
  removed?: boolean;
}

export namespace DebugError {
  export const NotFound = ApplicationError.declare(-41000, (type: string) => ({
    message: `'${type}' debugger type is not supported.`,
    data: { type },
  }));
}
