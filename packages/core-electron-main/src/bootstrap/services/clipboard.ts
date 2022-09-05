import { Injectable } from '@opensumi/di';
import { IClipboardService, CLIPBOARD_FILE_TOKEN } from '@opensumi/ide-core-common';
import { URI } from '@opensumi/ide-core-common';

export { IClipboardService, CLIPBOARD_FILE_TOKEN };

const { clipboard } = require('electron');

@Injectable()
export class ElectronClipboardService implements IClipboardService {
  async writeText(text: string): Promise<void> {
    return clipboard.writeText(text);
  }
  async readText(): Promise<string> {
    return clipboard.readText();
  }
  async writeResources(resources: URI[], field = CLIPBOARD_FILE_TOKEN): Promise<void> {
    // eslint-disable-next-line no-console
    const buffer = Buffer.from('writeBuffer', 'utf8');
    return;
  }
  async readResources(field = CLIPBOARD_FILE_TOKEN): Promise<URI[]> {
    // eslint-disable-next-line no-console
    console.log('electron: readResources', field);
    return [];
  }
}
