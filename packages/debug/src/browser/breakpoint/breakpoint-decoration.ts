import { localize } from '@opensumi/ide-core-browser';

import { IDebugBreakpoint } from '../../common';

import { isRuntimeBreakpoint } from './breakpoint-marker';

export interface IBreakpointDecoration {
  readonly className: string;
  readonly message: string[];
}

export class DebugDecorator {
  protected getDisabledBreakpointDecoration(breakpoint: IDebugBreakpoint): IBreakpointDecoration {
    const decoration = this.getBreakpointDecoration(breakpoint);
    return {
      className: decoration.className + '-disabled',
      message: [localize('debug.breakpoint.disabled') + decoration.message[0]],
    };
  }

  protected getBreakpointDecoration(breakpoint: IDebugBreakpoint, message?: string[]): IBreakpointDecoration {
    if (breakpoint.raw.logMessage) {
      return {
        className: 'sumi-debug-logpoint',
        message: message || [localize('debug.breakpoint.logpointMessage')],
      };
    }
    if (breakpoint.raw.condition || breakpoint.raw.hitCondition) {
      return {
        className: 'sumi-debug-conditional-breakpoint',
        message: message || [localize('debug.breakpoint.conditionalMessage')],
      };
    }
    return {
      className: 'sumi-debug-breakpoint',
      message: message || [localize('debug.breakpoint.breakpointMessage')],
    };
  }

  protected getUnverifiedBreakpointDecoration(breakpoint: IDebugBreakpoint): IBreakpointDecoration {
    const decoration = this.getBreakpointDecoration(breakpoint);
    return {
      className: decoration.className + '-unverified',
      message: [breakpoint.message || localize('debug.breakpoint.unverified') + decoration.message[0]],
    };
  }

  getDecoration(breakpoint: IDebugBreakpoint, isDebugMode = false, enabled = true): IBreakpointDecoration {
    if (!breakpoint.enabled || !enabled) {
      return this.getDisabledBreakpointDecoration(breakpoint);
    }
    if (isDebugMode && !isRuntimeBreakpoint(breakpoint)) {
      return this.getUnverifiedBreakpointDecoration(breakpoint);
    }
    return this.getBreakpointDecoration(breakpoint);
  }
}
