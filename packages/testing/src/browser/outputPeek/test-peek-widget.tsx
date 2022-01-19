import React from 'react';
import ReactDOM from 'react-dom';
import { PeekViewWidget } from '@opensumi/ide-monaco-enhance/lib/browser/peek-view';
import { Injectable, Autowired } from '@opensumi/di';

@Injectable({ multiple: true })
export class DebugBreakpointZoneWidget extends PeekViewWidget {
  protected _fillBody(container: HTMLElement): void {
    throw new Error('Method not implemented.');
  }
  protected applyClass(): void {
    throw new Error('Method not implemented.');
  }
  protected applyStyle(): void {
    throw new Error('Method not implemented.');
  }
}
