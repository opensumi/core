import { Disposable, Emitter, Event as BaseEvent, IDisposable } from '@ali/ide-core-common';
import { isWebKit } from '@ali/ide-core-common/lib/platform';

export const EventType = {
  // Mouse
  CLICK: 'click',
  DBLCLICK: 'dblclick',
  MOUSE_UP: 'mouseup',
  MOUSE_DOWN: 'mousedown',
  MOUSE_OVER: 'mouseover',
  MOUSE_MOVE: 'mousemove',
  MOUSE_OUT: 'mouseout',
  MOUSE_ENTER: 'mouseenter',
  MOUSE_LEAVE: 'mouseleave',
  CONTEXT_MENU: 'contextmenu',
  WHEEL: 'wheel',
  // Keyboard
  KEY_DOWN: 'keydown',
  KEY_PRESS: 'keypress',
  KEY_UP: 'keyup',
  // HTML Document
  LOAD: 'load',
  UNLOAD: 'unload',
  ABORT: 'abort',
  ERROR: 'error',
  RESIZE: 'resize',
  SCROLL: 'scroll',
  FULLSCREEN_CHANGE: 'fullscreenchange',
  WK_FULLSCREEN_CHANGE: 'webkitfullscreenchange',
  // Form
  SELECT: 'select',
  CHANGE: 'change',
  SUBMIT: 'submit',
  RESET: 'reset',
  FOCUS: 'focus',
  FOCUS_IN: 'focusin',
  FOCUS_OUT: 'focusout',
  BLUR: 'blur',
  INPUT: 'input',
  // Local Storage
  STORAGE: 'storage',
  // Drag
  DRAG_START: 'dragstart',
  DRAG: 'drag',
  DRAG_ENTER: 'dragenter',
  DRAG_LEAVE: 'dragleave',
  DRAG_OVER: 'dragover',
  DROP: 'drop',
  DRAG_END: 'dragend',
  // Animation
  ANIMATION_START: isWebKit ? 'webkitAnimationStart' : 'animationstart',
  ANIMATION_END: isWebKit ? 'webkitAnimationEnd' : 'animationend',
  ANIMATION_ITERATION: isWebKit ? 'webkitAnimationIteration' : 'animationiteration',
};

export type EventHandler = HTMLElement | HTMLDocument | Window;

export interface IFocusTracker extends Disposable {
  onDidFocus: BaseEvent<void>;
  onDidBlur: BaseEvent<void>;
}

export function isAncestor( testChild: Node | null, testAncestor: Node | null ): boolean {
  while ( testChild ) {
    if ( testChild === testAncestor ) {
      return true;
    }
    testChild = testChild.parentNode;
  }

  return false;
}

export class DomListener implements IDisposable {

  private _handler: (e: any) => void;
  private _node: Element | Window | Document;
  private readonly _type: string;
  private readonly _useCapture: boolean;

  constructor(node: Element | Window | Document, type: string, handler: (e: any) => void, useCapture?: boolean) {
    this._node = node;
    this._type = type;
    this._handler = handler;
    this._useCapture = (useCapture || false);
    this._node.addEventListener(this._type, this._handler, this._useCapture);
  }

  public dispose(): void {
    if (!this._handler) {
      // Already disposed
      return;
    }

    this._node.removeEventListener(this._type, this._handler, this._useCapture);

    // Prevent leakers from holding on to the dom or handler func
    this._node = null!;
    this._handler = null!;
  }
}

export class FocusTracker extends Disposable {

  private readonly didFocus = new Emitter<void>();
  public readonly onDidFocus: BaseEvent<void> = this.didFocus.event;

  private readonly didBlur = new Emitter<void>();
  public readonly onDidBlur: BaseEvent<void> = this.didBlur.event;

  constructor(element: HTMLElement | Window) {
    super();
    let hasFocus = isAncestor(document.activeElement, element as HTMLElement);
    let loosingFocus = false;

    const onFocus = () => {
      loosingFocus = false;
      if (!hasFocus) {
        hasFocus = true;
        this.didFocus.fire();
      }
    };

    const onBlur = () => {
      if (hasFocus) {
        loosingFocus = true;
        window.setTimeout( () => {
          if ( loosingFocus ) {
            loosingFocus = false;
            hasFocus = false;
            this.didBlur.fire();
          }
        }, 0 );
      }
    };

    this.addDispose(this.didBlur);
    this.addDispose(this.didFocus);
    this.addDispose(new DomListener(element, EventType.FOCUS, onFocus, true));
    this.addDispose(new DomListener(element, EventType.BLUR, onBlur, true));
  }
}

export function trackFocus(element: HTMLElement | Window): IFocusTracker {
  return new FocusTracker(element);
}
