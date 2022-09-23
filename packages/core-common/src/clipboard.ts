import { URI } from '@opensumi/ide-utils';

export const IClipboardService = Symbol('IClipboardService');
export const CLIPBOARD_FILE_TOKEN = 'clipboard/file-list';

export interface IClipboardService {
  /**
   * 写入文本
   */
  writeText(text: string): Promise<void>;

  /**
   * 读取文本
   */
  readText(): Promise<string>;

  /**
   * 写入资源
   */
  writeResources(resources: URI[], field?: string): Promise<void>;

  /**
   * 读取资源
   */
  readResources(field?: string): Promise<URI[]>;

  /**
   * 是否存在资源
   */
  hasResources(field?: string): Promise<boolean>;
}
