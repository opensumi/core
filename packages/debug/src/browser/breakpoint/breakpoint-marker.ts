import { URI } from '@opensumi/ide-core-common';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';
import btoa = require('btoa');
import { IRuntimeBreakpoint, ISourceBreakpoint } from '../../common';
import { Marker } from '../markers';

export const BREAKPOINT_KIND = 'breakpoint';

export type DebugBreakpoint = ISourceBreakpoint | IRuntimeBreakpoint;

function generateId(uri: string, line: number, column = 1) {
  return btoa(`${uri}:${line}:${column}`);
}

export namespace DebugBreakpoint {
  export function create(uri: URI, data: DebugProtocol.SourceBreakpoint, enabled = true): DebugBreakpoint {
    return {
      id: generateId(uri.toString(), data.line, data.column),
      uri: uri.toString(),
      enabled,
      status: new Map<string, DebugProtocol.Breakpoint>(),
      raw: {
        column: undefined,
        condition: undefined,
        hitCondition: undefined,
        logMessage: undefined,
        ...data,
      },
    };
  }
}

export interface IExceptionBreakpoint {
  label: string;
  filter: string;
  default?: boolean;
}

export type DebugExceptionBreakpoint = IExceptionBreakpoint;

export function isDebugBreakpoint(
  breakpoint: DebugBreakpoint | DebugExceptionBreakpoint,
): breakpoint is DebugBreakpoint {
  return !!breakpoint && !!(breakpoint as DebugBreakpoint).raw;
}

export function getStatus(breakpoint: IRuntimeBreakpoint) {
  return Array.from(breakpoint.status.values()).filter((b) => b.verified)[0];
}

export function isRuntimeBreakpoint(breakpoint: DebugBreakpoint): breakpoint is IRuntimeBreakpoint {
  const status = getStatus(breakpoint);
  return !!(status && status.verified);
}

export function isDebugExceptionBreakpoint(
  breakpoint: DebugBreakpoint | DebugExceptionBreakpoint,
): breakpoint is DebugExceptionBreakpoint {
  return breakpoint && !!(breakpoint as DebugExceptionBreakpoint).filter;
}

export interface BreakpointMarker extends Marker<DebugBreakpoint> {
  kind: 'breakpoint';
}

export namespace BreakpointMarker {
  export function is(node: Marker<object>): node is BreakpointMarker {
    return 'kind' in node && node.kind === BREAKPOINT_KIND;
  }
}
