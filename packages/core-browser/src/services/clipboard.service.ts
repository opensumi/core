import { Autowired, Injectable } from '@opensumi/di';
import { CLIPBOARD_FILE_TOKEN, IClipboardService, URI } from '@opensumi/ide-core-common';

import { ILogger } from '../logger';

import { GlobalBrowserStorageService } from './storage-service';

export { CLIPBOARD_FILE_TOKEN, IClipboardService };

@Injectable()
export class BrowserClipboardService implements IClipboardService {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(GlobalBrowserStorageService)
  private readonly browserStorage: GlobalBrowserStorageService;

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
    textArea.focus({
      preventScroll: true,
    });
    textArea.select();

    document.execCommand('copy');

    if (activeElement instanceof HTMLElement) {
      activeElement.focus({
        preventScroll: true,
      });
    }

    document.body.removeChild(textArea);

    return;
  }
  async readText(): Promise<string> {
    try {
      if (!navigator.clipboard) {
        throw new Error('The current environment does not support the `clipboard` API');
      }
      return await navigator.clipboard.readText();
    } catch (error) {
      this.logger.error(error);
      return '';
    }
  }
  async writeResources(resources: URI[], field = CLIPBOARD_FILE_TOKEN): Promise<void> {
    this.browserStorage.setData(
      field,
      resources.filter((uri) => Boolean(uri)).map((uri) => uri.toString()),
    );
  }

  async readResources(field = CLIPBOARD_FILE_TOKEN): Promise<URI[]> {
    const localStorgeUriList = this.browserStorage.getData(field);
    if (
      !Array.isArray(localStorgeUriList) ||
      !localStorgeUriList.length ||
      !localStorgeUriList.every((str) => typeof str === 'string' && URI.isUriString(str))
    ) {
      return [];
    }
    return localStorgeUriList.map((str) => URI.parse(str));
  }
  async hasResources(field?: string | undefined): Promise<boolean> {
    const localStorgeUriList = this.browserStorage.getData(field ?? CLIPBOARD_FILE_TOKEN) ?? '';
    if (
      !Array.isArray(localStorgeUriList) ||
      !localStorgeUriList.length ||
      !localStorgeUriList.every((str) => typeof str === 'string' && URI.isUriString(str))
    ) {
      return false;
    }
    return true;
  }
}
