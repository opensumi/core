import { IBasicTreeData } from '@opensumi/ide-components';
import { Emitter, URI } from '@opensumi/ide-core-common';

import { isDebugBreakpoint } from '../../breakpoint';

import { BreakpointItem } from './debug-breakpoints.view';

export class BreakpointsTreeNode implements IBasicTreeData {
  public label = '';
  public rawData: BreakpointItem;
  private _uri: URI;
  private _onDescriptionChange = new Emitter<string>();

  constructor(uri: URI, rawData: BreakpointItem) {
    const { breakpoint } = rawData;

    this._uri = uri;
    this.label = isDebugBreakpoint(breakpoint) ? uri.displayName : '';
    this.rawData = rawData;
    this.rawData.onDescriptionChange = this._onDescriptionChange.event;
  }

  get breakpoint() {
    return this.rawData.breakpoint;
  }

  get uri() {
    return this._uri;
  }

  fireDescriptionChange(value: string): void {
    this.rawData.description = value;
    this._onDescriptionChange.fire(value);
  }
}
