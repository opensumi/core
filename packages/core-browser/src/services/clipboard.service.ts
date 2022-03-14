import { Autowired, Injectable } from '@opensumi/di';

import { ILogger } from '../logger';

export const IClipboardService = Symbol('IClipboardService');
export interface IClipboardService {
  /**
   * 写到粘贴板
   */
  writeText(text: string): Promise<void>;

  /**
   * 读取粘贴板
   */
  readText(): Promise<string>;
}

@Injectable()
export class BrowserClipboardService implements IClipboardService {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  async writeText(text: string): Promise<void> {
    try {
      // 优先使用 clipboard 设置
      // clipboard 在非 https 下会报错
      return await navigator.clipboard.writeText(text);
    } catch (error) {
      this.logger.error(error);
    }

    // Fallback to textarea and execCommand solution
    const activeElement = document.activeElement;

    const textArea = document.createElement('textarea');
    textArea.setAttribute('aria-hidden', 'true');
    document.body.appendChild(textArea);
    textArea.style.height = '1px';
    textArea.style.width = '1px';
    textArea.style.position = 'absolute';

    textArea.value = text;
    textArea.focus();
    textArea.select();

    document.execCommand('copy');

    if (activeElement instanceof HTMLElement) {
      activeElement.focus();
    }

    document.body.removeChild(textArea);

    return;
  }
  async readText(): Promise<string> {
    try {
      if (!navigator.clipboard) {
        throw new Error('当前环境不支持剪贴板API');
      }
      return await navigator.clipboard.readText();
    } catch (error) {
      this.logger.error(error);
      return '';
    }
  }
}
