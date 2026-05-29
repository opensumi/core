/**
 * Agent update types — legacy stream format used by AcpAgentService
 * and compatibility adapters.
 */

import type { ThreadStatus } from './acp-thread';

export type AgentUpdateType =
  | 'thought'
  | 'message'
  | 'tool_call'
  | 'tool_call_args'
  | 'tool_call_status'
  | 'tool_result'
  | 'plan'
  | 'done'
  | 'thread_status';

export interface SimpleToolCall {
  toolCallId: string;
  name: string;
  input?: unknown;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface AgentUpdate {
  type: AgentUpdateType;
  content: string;
  toolCall?: SimpleToolCall;
  threadStatus?: ThreadStatus;
}
