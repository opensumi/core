import type { IBufferRange, ILink, ILinkDecorations, IViewportRange, Terminal } from 'xterm';

import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  Disposable,
  IDisposable,
  DisposableCollection,
  Emitter,
  Event,
  isOSX,
  RunOnceScheduler,
  localize,
} from '@opensumi/ide-core-common';

import { convertBufferRangeToViewport } from './helpers';

// default delay time (ms) for showing tooltip when mouse is over a link
const DEFAULT_HOVER_DELAY = 500;

export const OPEN_FILE_LABEL = localize('terminal.openFile', 'Open file in editor');
export const FOLDER_IN_WORKSPACE_LABEL = localize('terminal.focusFolder', 'Focus folder in explorer');
export const FOLDER_NOT_IN_WORKSPACE_LABEL = localize('terminal.openFolder', 'Open folder in new window');

@Injectable({ multiple: true })
export class TerminalLink extends Disposable implements ILink {
  decorations: ILinkDecorations;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private _tooltipScheduler: RunOnceScheduler | undefined;
  private _hoverListeners: DisposableCollection | undefined;
  private _tooltipDisposable: IDisposable | undefined;

  private readonly _onInvalidated = new Emitter<void>();
  public get onInvalidated(): Event<void> {
    return this._onInvalidated.event;
  }

  constructor(
    private readonly _xterm: Terminal,
    public readonly range: IBufferRange,
    public readonly text: string,
    private readonly _viewportY: number,
    private readonly _activateCallback: (event: MouseEvent | undefined, uri: string) => void,
    private readonly _tooltipCallback: (
      link: TerminalLink,
      viewportRange: IViewportRange,
      modifierDownCallback?: () => void,
      modifierUpCallback?: () => void,
    ) => IDisposable,
    private readonly _isHighConfidenceLink: boolean,
    readonly label: string | undefined,
  ) {
    super();
    this.decorations = {
      pointerCursor: false,
      underline: this._isHighConfidenceLink,
    };
  }

  dispose(): void {
    super.dispose();
    this._hoverListeners?.dispose();
    this._hoverListeners = undefined;
    this._tooltipScheduler?.dispose();
    this._tooltipScheduler = undefined;
    this._tooltipDisposable?.dispose();
    this._tooltipDisposable = undefined;
  }

  activate(event: MouseEvent | undefined, text: string): void {
    this._activateCallback(event, text);
  }

  private _addDisposableListener(node: Node, type: string, handler: EventListener) {
    node.addEventListener(type, handler);
    return Disposable.create(() => {
      node.removeEventListener(type, handler);
    });
  }

  hover(event: MouseEvent, text: string): void {
    // Listen for modifier before handing it off to the hover to handle so it gets disposed correctly
    this._hoverListeners = new DisposableCollection();
    this._hoverListeners.push(
      this._addDisposableListener(document, 'keydown', (e) => {
        if (!e.repeat && this._isModifierDown(e)) {
          this._enableDecorations();
        }
      }),
    );
    this._hoverListeners.push(
      this._addDisposableListener(document, 'keyup', (e) => {
        if (!e.repeat && !this._isModifierDown(e)) {
          this._disableDecorations();
        }
      }),
    );

    // Listen for when the terminal renders on the same line as the link
    this._hoverListeners.push(
      this._xterm.onRender((e) => {
        const viewportRangeY = this.range.start.y - this._viewportY;
        if (viewportRangeY >= e.start && viewportRangeY <= e.end) {
          this._onInvalidated.fire();
        }
      }),
    );

    // Only show the tooltip and highlight for high confidence links (not word/search workspace
    // links). Feedback was that this makes using the terminal overly noisy.
    if (this._isHighConfidenceLink) {
      this._tooltipScheduler = new RunOnceScheduler(() => {
        this._tooltipDisposable = this._tooltipCallback(
          this,
          convertBufferRangeToViewport(this.range, this._viewportY),
          this._isHighConfidenceLink ? () => this._enableDecorations() : undefined,
          this._isHighConfidenceLink ? () => this._disableDecorations() : undefined,
        );
        // Clear out scheduler until next hover event
        this._tooltipScheduler?.dispose();
        this._tooltipScheduler = undefined;
      }, this.preferenceService.get<number>('editor.hover.delay') || DEFAULT_HOVER_DELAY);
      this._tooltipScheduler.schedule();
    }

    const origin = { x: event.pageX, y: event.pageY };
    this._hoverListeners.push(
      this._addDisposableListener(document, 'mousemove', (e) => {
        // Update decorations
        if (this._isModifierDown(e)) {
          this._enableDecorations();
        } else {
          this._disableDecorations();
        }

        // Reset the scheduler if the mouse moves too much
        if (
          Math.abs(e.pageX - origin.x) > window.devicePixelRatio * 2 ||
          Math.abs(e.pageY - origin.y) > window.devicePixelRatio * 2
        ) {
          origin.x = e.pageX;
          origin.y = e.pageY;
          this._tooltipScheduler?.schedule();
        }
      }),
    );
  }

  leave(): void {
    this._hoverListeners?.dispose();
    this._hoverListeners = undefined;
    this._tooltipScheduler?.dispose();
    this._tooltipScheduler = undefined;
    this._tooltipDisposable?.dispose();
    this._tooltipDisposable = undefined;
  }

  private _enableDecorations(): void {
    if (!this.decorations.pointerCursor) {
      this.decorations.pointerCursor = true;
    }
    if (!this.decorations.underline) {
      this.decorations.underline = true;
    }
  }

  private _disableDecorations(): void {
    if (this.decorations.pointerCursor) {
      this.decorations.pointerCursor = false;
    }
    if (this.decorations.underline !== this._isHighConfidenceLink) {
      this.decorations.underline = this._isHighConfidenceLink;
    }
  }

  private _isModifierDown(event: MouseEvent | KeyboardEvent): boolean {
    return isOSX ? event.metaKey : event.ctrlKey;
  }
}
