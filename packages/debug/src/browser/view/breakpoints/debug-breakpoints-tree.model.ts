import { IBasicTreeData } from '@opensumi/ide-components';
import { URI } from '@opensumi/ide-core-common';

import { isDebugBreakpoint } from '../../breakpoint';

import { BreakpointItem } from './debug-breakpoints.view';

export class BreakpointsTreeNode implements IBasicTreeData {
  public label = '';
  public rawData: BreakpointItem;

  constructor(uri: URI, rawData: BreakpointItem) {
    const { breakpoint } = rawData;

    this.label = isDebugBreakpoint(breakpoint) ? uri.displayName : '';
    this.rawData = rawData;
  }

  get breakpoint() {
    return this.rawData.breakpoint;
  }
}
