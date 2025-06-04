import { Event, URI } from '@opensumi/ide-core-common/lib/utils';

import { ProjectRule } from './types';

export interface LLMContextService {
  /**
   * 开始自动收集
   */
  startAutoCollection(): void;

  /**
   * 停止自动收集
   */
  stopAutoCollection(): void;

  /**
   * 添加文件到 context 中
   */
  addFileToContext(uri: URI, selection?: [number, number], isManual?: boolean): void;

  /**
   * 添加文件夹到 context 中
   */
  addFolderToContext(uri: URI, isManual?: boolean): void;

  /**
   * 添加规则到 context 中
   */
  addRuleToContext(uri: URI, isManual?: boolean): void;

  /**
   * 清除上下文
   */
  cleanFileContext(): void;

  /**
   * 上下文文件变化事件
   */
  onDidContextFilesChangeEvent: Event<{
    viewed: FileContext[];
    attached: FileContext[];
    attachedFolders: FileContext[];
    attachedRules: ProjectRule[];
    version: number;
  }>;

  /**
   * 从 context 中移除文件
   * @param uri URI
   */
  removeFileFromContext(uri: URI, isManual?: boolean): void;

  /**
   * 从 context 中移除文件夹
   * @param uri URI
   */
  removeFolderFromContext(uri: URI): void;

  /**
   * 从 context 中移除规则
   * @param uri URI
   */
  removeRuleFromContext(uri: URI): void;

  /** 导出为可序列化格式 */
  serialize(): Promise<SerializedContext>;
}

export interface FileContext {
  uri: URI;
  selection?: [number, number];
}

export const LLMContextServiceToken = Symbol('LLMContextService');

export interface AttachFileContext {
  content: string;
  lineErrors: string[];
  path: string;
  language: string;
  selection?: [number, number];
}

export interface SerializedContext {
  recentlyViewFiles: string[];
  attachedFiles: Array<AttachFileContext>;
  attachedFolders: string[];
  attachedRules: string[];
  globalRules: string[];
}

export enum LLM_CONTEXT_KEY {
  AttachedFile = '<attached_file>',
  AttachedFolder = '<attached_folder>',
}

export const LLM_CONTEXT_KEY_REGEX = /<attached_file>|<attached_folder>/g;
