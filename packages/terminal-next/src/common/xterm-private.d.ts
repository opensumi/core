import { IBufferCell } from '@xterm/xterm';

export type XTermAttributes = Omit<IBufferCell, 'getWidth' | 'getChars' | 'getCode'> & { clone?(): XTermAttributes };

export interface XTermCore {
  viewport?: {
    _innerRefresh(): void;
  };
  _onKey: IEventEmitter<{ key: string }>;

  _charSizeService: {
    width: number;
    height: number;
  };

  element: HTMLElement;

  _coreService: {
    triggerDataEvent(data: string, wasUserInput?: boolean): void;
  };

  _inputHandler: {
    _curAttrData: XTermAttributes;
  };

  _renderService: {
    dimensions: {
      css: {
        cell: {
          width: number;
          height: number;
        };
      };
    };
    _renderer: {
      value?: unknown;
    };
  };
}

export interface IEventEmitter<T> {
  fire(e: T): void;
}
