import { Injectable } from '@opensumi/di';
import { IClipboardService, CLIPBOARD_FILE_TOKEN } from '@opensumi/ide-core-common';
import { URI } from '@opensumi/ide-core-common';

export { CLIPBOARD_FILE_TOKEN };

const { clipboard } = require('electron');
export const INativeClipboardService = Symbol('INativeClipboardService');

@Injectable()
export class ElectronClipboardService implements IClipboardService {
  async writeText(text: string): Promise<void> {
    return clipboard.writeText(text);
  }
  async readText(): Promise<string> {
    return clipboard.readText();
  }
  async writeResources(resources: URI[], field = CLIPBOARD_FILE_TOKEN): Promise<void> {
    try {
      const buffer = Buffer.from(JSON.stringify(resources.map((uri) => uri.toString())), 'utf8');
      return clipboard.writeBuffer(field, Buffer.from(buffer));
    } catch {}
  }
  async readResources(field = CLIPBOARD_FILE_TOKEN): Promise<URI[]> {
    try {
      const list = clipboard.readBuffer(field).toJSON().data;
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
