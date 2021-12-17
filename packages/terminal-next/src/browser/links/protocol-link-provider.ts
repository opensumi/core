import type { Terminal, IBufferLine } from 'xterm';
import { ILinkComputerTarget, LinkComputer } from '../../common';
import { getXtermLineContent, convertLinkRangeToBuffer } from './helpers';
import { TerminalLink } from './link';
import { TerminalBaseLinkProvider } from './base';

export class TerminalProtocolLinkProvider extends TerminalBaseLinkProvider {
  private _linkComputerTarget: ILinkComputerTarget | undefined;

  constructor(
    private readonly _xterm: Terminal,
    private readonly _activateCallback: (event: MouseEvent | undefined, uri: string) => void,
  ) {
    super();
  }

  protected _provideLinks(y: number): TerminalLink[] {
    let startLine = y - 1;
    let endLine = startLine;

    const lines: IBufferLine[] = [this._xterm.buffer.active.getLine(startLine)!];

    while (startLine >= 0 && this._xterm.buffer.active.getLine(startLine)?.isWrapped) {
      lines.unshift(this._xterm.buffer.active.getLine(startLine - 1)!);
      startLine--;
    }

    while (endLine < this._xterm.buffer.active.length && this._xterm.buffer.active.getLine(endLine + 1)?.isWrapped) {
      lines.push(this._xterm.buffer.active.getLine(endLine + 1)!);
      endLine++;
    }

    this._linkComputerTarget = new TerminalLinkAdapter(this._xterm, startLine, endLine);
    const links = LinkComputer.computeLinks(this._linkComputerTarget);

    return links.map((link) => {
      const range = convertLinkRangeToBuffer(lines, this._xterm.cols, link.range, startLine);

      // Check if the link if within the mouse position
      return new TerminalLink(
        this._xterm,
        range,
        link.url?.toString() || '',
        this._xterm.buffer.active.viewportY,
        this._activateCallback,
        true,
      );
    });
  }
}

class TerminalLinkAdapter implements ILinkComputerTarget {
  constructor(private _xterm: Terminal, private _lineStart: number, private _lineEnd: number) {}

  getLineCount(): number {
    return 1;
  }

  getLineContent(): string {
    return getXtermLineContent(this._xterm.buffer.active, this._lineStart, this._lineEnd, this._xterm.cols);
  }
}
