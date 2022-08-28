import { Autowired, Injectable } from '@opensumi/di';
import { IClipboardService } from '@opensumi/ide-core-common';
import { URI } from '@opensumi/ide-core-common';

import { ILogger } from '../logger';

export const PASTE_FILE_LOCAL_TOKEN = 'paste-uri-list';
export { IClipboardService } from '@opensumi/ide-core-common';

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
  async writeResources(resources: URI[], field = PASTE_FILE_LOCAL_TOKEN): Promise<void> {
    try {
      localStorage.setItem(field, JSON.stringify(resources.map((uri) => uri.toString())));
    } catch (e) {
      this.logger.error(e);
    }
  }
  async readResources(field = PASTE_FILE_LOCAL_TOKEN): Promise<URI[]> {
    try {
      const localStorgeUriList = JSON.parse(localStorage.getItem(field) ?? '');
      if (
        !Array.isArray(localStorgeUriList) ||
        !localStorgeUriList.length ||
        !localStorgeUriList.every((str) => typeof str === 'string' && URI.isUriString(str))
      ) {
        return [];
      }
      return localStorgeUriList.map((str) => URI.parse(str));
    } catch (e) {
      this.logger.error(e);
      return [];
    }
  }
}
