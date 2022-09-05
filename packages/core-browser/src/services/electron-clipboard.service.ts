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
      const buffer = Buffer.from(JSON.stringify(resources), 'utf8');
      return await this.electronMainUIService.writeClipboardBuffer(field, Buffer.from(buffer));
    } catch {}
  }
  async readResources(field = CLIPBOARD_FILE_TOKEN): Promise<URI[]> {
    try {
      const list = Buffer.from(await this.electronMainUIService.readClipboardBuffer(field)).toJSON().data;
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
}
