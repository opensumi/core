import {
  IDisposable,
  IJSONSchema,
  IJSONSchemaSnippet,
  ApplicationError,
  Event,
  BinaryBuffer,
} from '@opensumi/ide-core-common';

import { DebugConfiguration } from './debug-configuration';
import { IDebugSessionDTO } from './debug-session-options';

export interface IMemoryInvalidationEvent {
  fromOffset: number;
  toOffset: number;
}

export const enum MemoryRangeType {
  Valid,
  Unreadable,
  Error,
}

export interface IMemoryRange {
  type: MemoryRangeType;
  offset: number;
  length: number;
}

export interface IUnreadableMemoryRange extends IMemoryRange {
  type: MemoryRangeType.Unreadable;
}

export interface IErrorMemoryRange extends IMemoryRange {
  type: MemoryRangeType.Error;
  error: string;
}

export interface IValidMemoryRange extends IMemoryRange {
  type: MemoryRangeType.Valid;
  offset: number;
  length: number;
  data: BinaryBuffer;
}

/**
 * Union type of memory that can be returned from read(). Since a read request
 * could encompass multiple previously-read ranges, multiple of these types
 * are possible to return.
 */
export type MemoryRange = IValidMemoryRange | IUnreadableMemoryRange | IErrorMemoryRange;

/**
 * An IMemoryRegion corresponds to a contiguous range of memory referred to
 * by a DAP `memoryReference`.
 */
export interface IMemoryRegion extends IDisposable {
  /**
   * Event that fires when memory changes. Can be a result of memory events or
   * `write` requests.
   */
  readonly onDidInvalidate: Event<IMemoryInvalidationEvent>;

  /**
   * Whether writes are supported on this memory region.
   */
  readonly writable: boolean;

  /**
   * Requests memory ranges from the debug adapter. It returns a list of memory
   * ranges that overlap (but may exceed!) the given offset. Use the `offset`
   * and `length` of each range for display.
   */
  read(fromOffset: number, toOffset: number): Promise<MemoryRange[]>;

  /**
   * Writes memory to the debug adapter at the given offset.
   */
  write(offset: number, data: BinaryBuffer): Promise<number>;
}

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
