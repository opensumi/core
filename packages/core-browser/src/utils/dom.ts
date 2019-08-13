import { IDisposable } from '@ali/ide-core-common';

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
