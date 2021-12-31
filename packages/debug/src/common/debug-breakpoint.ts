import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

export interface ISourceBreakpoint {
  id: string;
  enabled: boolean;
  uri: string;
  raw: DebugProtocol.SourceBreakpoint;
  logMessage?: string;
  message?: string;
  status: Map<string, DebugProtocol.Breakpoint>;
}

export interface IRuntimeBreakpoint extends ISourceBreakpoint {
  status: Map<string, DebugProtocol.Breakpoint>;
}

export type TSourceBrekpointProperties = keyof Pick<
  DebugProtocol.SourceBreakpoint,
  'condition' | 'hitCondition' | 'logMessage'
>;

export interface BreakpointChangeData {
  context: TSourceBrekpointProperties;
  value: string;
}

export type DebugBreakpointWidgetContext = {
  [context in TSourceBrekpointProperties]?: string;
};
