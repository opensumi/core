import { Injectable, Autowired } from '@opensumi/di';
import { IClipboardService, CLIPBOARD_FILE_TOKEN } from '@opensumi/ide-core-common';
import { URI } from '@opensumi/ide-core-common';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';

export { CLIPBOARD_FILE_TOKEN };

export const INativeClipboardService = Symbol('INativeClipboardService');

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface INativeClipboardService extends IClipboardService {}

@Injectable()
export class ElectronClipboardService implements INativeClipboardService {
  @Autowired(IElectronMainUIService)
  private electronMainUIService: IElectronMainUIService;

  async writeText(text: string): Promise<void> {
    return await this.electronMainUIService.writeClipboardText(text);
  }
  async readText(): Promise<string> {
    return await this.electronMainUIService.readClipboardText();
  }
  async writeResources(resources: URI[], field = CLIPBOARD_FILE_TOKEN): Promise<void> {
    try {
      const buffer = Buffer.from(JSON.stringify(resources.map((uri) => uri.toString())), 'utf8');
      return await this.electronMainUIService.writeClipboardBuffer(field, buffer);
    } catch {}
  }
  async readResources(field = CLIPBOARD_FILE_TOKEN): Promise<URI[]> {
    try {
      const buffer = await this.electronMainUIService.readClipboardBuffer(field);
      const list = JSON.parse(Buffer.from(buffer).toString('utf8'));
      if (
        !Array.isArray(list) ||
        !list.length ||
        !list.every((str) => typeof str === 'string' && URI.isUriString(str))
      ) {
        return [];
      }
      return list.map((str) => URI.parse(str));
    } catch {
      return [];
    }
  }
  async hasResources(field?: string | undefined): Promise<boolean> {
    try {
      const buffer = await this.electronMainUIService.readClipboardBuffer(field ?? CLIPBOARD_FILE_TOKEN);
      const list = JSON.parse(Buffer.from(buffer).toString('utf8'));
      if (
        !Array.isArray(list) ||
        !list.length ||
        !list.every((str) => typeof str === 'string' && URI.isUriString(str))
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
