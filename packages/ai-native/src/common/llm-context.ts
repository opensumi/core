import { Event, URI } from '@opensumi/ide-core-common/lib/utils';

export interface LLMContextService {
  startAutoCollection(): void;

  stopAutoCollection(): void;

  /**
   * 添加文件到 context 中
   */
  addFileToContext(uri: URI, selection?: [number, number], isManual?: boolean): void;

  /**
   * 清除上下文
   */
  cleanFileContext(): void;

  onDidContextFilesChangeEvent: Event<FileContext[]>;

  /**
   * 从 context 中移除文件
   * @param uri URI
   */
  removeFileFromContext(uri: URI): void;

  /** 导出为可序列化格式 */
  serialize(): SerializedContext;
}

export interface FileContext {
  uri: URI;
  selection?: [number, number];
  isManual: boolean;
}

export const LLMContextServiceToken = Symbol('LLMContextService');

export interface SerializedContext {
  recentlyViewFiles: string[];
  attachedFiles: Array<{ content: string; lineErrors: string[]; path: string; language: string }>;
}
