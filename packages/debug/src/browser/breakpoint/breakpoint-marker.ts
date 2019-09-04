import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { Marker } from '../markers';
import { uuid, URI } from '@ali/ide-core-browser';

export const BREAKPOINT_KIND = 'breakpoint';

export interface SourceBreakpoint {
  id: string;
  uri: string;
  enabled: boolean;
  raw: DebugProtocol.SourceBreakpoint;
}

export namespace SourceBreakpoint {
  export function create(uri: URI, data: DebugProtocol.SourceBreakpoint, origin?: SourceBreakpoint): SourceBreakpoint {
    return {
      id: origin ? origin.id : uuid(),
      uri: uri.toString(),
      enabled: origin ? origin.enabled : true,
      raw: {
        ...(origin && origin.raw),
        ...data,
      },
    };
  }
}

export interface BreakpointMarker extends Marker<SourceBreakpoint> {
  kind: 'breakpoint';
}

export namespace BreakpointMarker {
  export function is(node: Marker<object>): node is BreakpointMarker {
    return 'kind' in node && node.kind === BREAKPOINT_KIND;
  }
}
