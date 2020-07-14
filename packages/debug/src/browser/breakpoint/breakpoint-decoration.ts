import { localize } from '@ali/ide-core-browser';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugBreakpoint, isRuntimeBreakpoint } from './breakpoint-marker';

export class DebugBreakpointDecoration {
  readonly className: string;
  readonly message: string[];
}

function isStatusVerified(status: Map<string, DebugProtocol.Breakpoint>) {
  for (const b of status.values()) {
    if (b.verified) {
      return true;
    }
  }
  return false;
}

export class DebugDecorator {
  protected getDisabledBreakpointDecoration(breakpoint: DebugBreakpoint): DebugBreakpointDecoration {
    const decoration = this.getBreakpointDecoration(breakpoint);
    return {
      className: decoration.className + '-disabled',
      message: [localize('debug.breakpoint.disabled') + decoration.message[0]],
    };
  }

  protected getBreakpointDecoration(breakpoint: DebugBreakpoint, message?: string[]): DebugBreakpointDecoration {
    if (breakpoint.raw.logMessage) {
      return {
        className: 'kaitian-debug-logpoint',
        message: message || [localize('debug.breakpoint.logpointMessage')],
      };
    }
    if (breakpoint.raw.condition || breakpoint.raw.hitCondition) {
      return {
        className: 'kaitian-debug-conditional-breakpoint',
        message: message || [localize('debug.breakpoint.conditionalMessage')],
      };
    }
    return {
      className: 'kaitian-debug-breakpoint',
      message: message || [localize('debug.breakpoint.breakpointMessage')],
    };
  }

  protected getUnverifiedBreakpointDecoration(breakpoint: DebugBreakpoint): DebugBreakpointDecoration {
    const decoration = this.getBreakpointDecoration(breakpoint);
    return {
      className: decoration.className + '-unverified',
      message: [breakpoint.message || localize('debug.breakpoint.unverified') + decoration.message[0]],
    };
  }

  getDecoration(breakpoint: DebugBreakpoint, isDebugMode = false): DebugBreakpointDecoration {
    if (!breakpoint.enabled) {
      return this.getDisabledBreakpointDecoration(breakpoint);
    }
    if (isRuntimeBreakpoint(breakpoint) && !isStatusVerified(breakpoint.status)) {
      return this.getUnverifiedBreakpointDecoration(breakpoint);
    }
    if (isDebugMode && !isRuntimeBreakpoint(breakpoint)) {
      return this.getUnverifiedBreakpointDecoration(breakpoint);
    }
    return this.getBreakpointDecoration(breakpoint);
  }
}
