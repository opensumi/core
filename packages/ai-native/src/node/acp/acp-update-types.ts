/**
 * Agent update types — shared format used by both AcpThread (translation)
 * and AcpAgentService (stream consumption).
 */

export type AgentUpdateType =
  | 'thought'
  | 'message'
  | 'tool_call'
  | 'tool_call_status'
  | 'tool_result'
  | 'plan'
  | 'done';

export interface SimpleToolCall {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface AgentUpdate {
  type: AgentUpdateType;
  content: string;
  toolCall?: SimpleToolCall;
}
