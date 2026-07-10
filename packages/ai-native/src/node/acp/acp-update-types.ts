/**
 * Agent update types — legacy stream format used by AcpAgentService
 * and compatibility adapters.
 */

import type { ThreadStatus } from './acp-thread';
import type { AvailableCommand } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';


export type AgentUpdateType =
  | 'thought'
  | 'message'
  | 'tool_call'
  | 'tool_call_args'
  | 'tool_call_status'
  | 'tool_result'
  | 'plan'
  | 'done'
  | 'thread_status'
  | 'session_state';

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
  sessionId?: string;
  currentModeId?: string;
  currentModelId?: string;
  configOptions?: Record<string, any>[];
  availableCommands?: AvailableCommand[];
}
