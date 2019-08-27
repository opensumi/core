import { IDisposable, IJSONSchema,  IJSONSchemaSnippet} from '@ali/ide-core-common';
import { DebugConfiguration } from './debug-configuration';

export interface DebuggerDescription {
    type: string;
    label: string;
}

export const DebugAdapterPath = '/services/debug-adapter';

export const DebugService = Symbol('DebugService');

export interface DebugService extends IDisposable {
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
  resolveDebugConfiguration(config: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration>;

  /**
   * 创建一个新的DebugAdapterSession进程
   * @param config 传入配置
   * @returns DebugAdapterSession对应sessionId.
   */
  createDebugSession(config: DebugConfiguration): Promise<string>;

  /**
   * 终止一个调试进程
   * @param sessionId
   */
  terminateDebugSession(sessionId: string): Promise<void>;
}
