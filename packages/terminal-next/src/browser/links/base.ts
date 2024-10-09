import { TerminalLink } from './link';

import type { ILink, ILinkProvider } from '@xterm/xterm';

export abstract class TerminalBaseLinkProvider implements ILinkProvider {
  private _activeLinks: TerminalLink[] | undefined;

  async provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): Promise<void> {
    this._activeLinks?.forEach((l) => l.dispose);
    this._activeLinks = await this._provideLinks(bufferLineNumber);
    callback(this._activeLinks);
  }

  protected abstract _provideLinks(bufferLineNumber: number): Promise<TerminalLink[]> | TerminalLink[];
}
