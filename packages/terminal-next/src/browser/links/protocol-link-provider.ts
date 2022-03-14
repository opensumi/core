import type { Terminal, IBufferLine, IViewportRange } from 'xterm';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';

import { ILinkComputerTarget, LinkComputer } from '../../common';

import { TerminalBaseLinkProvider } from './base';
import { getXtermLineContent, convertLinkRangeToBuffer } from './helpers';
import { TerminalLink } from './link';

@Injectable({ multiple: true })
export class TerminalProtocolLinkProvider extends TerminalBaseLinkProvider {
  private _linkComputerTarget: ILinkComputerTarget | undefined;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  constructor(
    private readonly _xterm: Terminal,
    private readonly _activateCallback: (event: MouseEvent | undefined, uri: string) => void,
    private readonly _tooltipCallback: (
      link: TerminalLink,
      viewportRange: IViewportRange,
      modifierDownCallback?: () => void,
      modifierUpCallback?: () => void,
    ) => IDisposable,
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
      return this.injector.get(TerminalLink, [
        this._xterm,
        range,
        link.url?.toString() || '',
        this._xterm.buffer.active.viewportY,
        this._activateCallback,
        this._tooltipCallback,
        true,
        undefined,
      ]);
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
