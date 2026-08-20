import { SessionNotification } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

import type { AgentUpdate } from './acp-update-types';

interface PlanEntryLike {
  content: string;
  completed?: boolean;
  status?: string;
}

function getPlanEntries(update: any): PlanEntryLike[] | undefined {
  const entries = update.plan?.entries ?? update.entries;
  return Array.isArray(entries) ? entries : undefined;
}

/**
 * Translate a native ACP SessionNotification into the legacy AgentUpdate format
 * for stream consumers that have not migrated to ACP-native updates yet.
 */
export function toAgentUpdate(notification: SessionNotification): AgentUpdate | AgentUpdate[] | null {
  const update = (notification as any).update;
  if (!update) {
    return null;
  }

  switch (update.sessionUpdate) {
    case 'agent_thought_chunk': {
      const content = update.content;
      if (content?.type === 'text') {
        return { type: 'thought', content: content.text };
      }
      return null;
    }

    case 'agent_message_chunk': {
      const content = update.content;
      if (content?.type === 'text') {
        return { type: 'message', content: content.text };
      }
      return null;
    }

    case 'tool_call': {
      return {
        type: 'tool_call',
        content: update.title || update.toolCallId || '',
        toolCall: {
          toolCallId: update.toolCallId || '',
          name: update.title || update.toolCallId || '',
          input: update.rawInput !== undefined ? update.rawInput : {},
          status: 'pending' as const,
        },
      };
    }

    case 'tool_call_update': {
      const updates: AgentUpdate[] = [];
      if (update.rawInput !== undefined) {
        updates.push({
          type: 'tool_call_args',
          content: '',
          toolCall: {
            toolCallId: update.toolCallId || '',
            name: update.title || '',
            input: update.rawInput,
          },
        });
      }
      if (update.status === 'completed' || update.status === 'failed') {
        if (update.rawOutput != null) {
          const outputText = typeof update.rawOutput === 'string' ? update.rawOutput : JSON.stringify(update.rawOutput);
          updates.push({
            type: 'tool_result',
            content: outputText.slice(0, 2000),
            toolCall: {
              toolCallId: update.toolCallId || '',
              name: '',
              status: update.status as 'completed' | 'failed',
            },
          });
        }
        return updates.length ? updates : null;
      }
      if (update.status === 'in_progress') {
        updates.push({
          type: 'tool_call_status',
          content: update.title || '',
          toolCall: {
            toolCallId: update.toolCallId || '',
            name: update.title || '',
            status: 'in_progress' as const,
          },
        });
        return updates;
      }
      if (update.content) {
        for (const item of update.content) {
          if (item.type === 'diff') {
            updates.push({
              type: 'tool_result',
              content: `Modified ${item.path}`,
            });
            break;
          }
        }
      }
      return updates.length ? updates : null;
    }

    case 'plan': {
      const entries = getPlanEntries(update);
      if (entries?.length) {
        const planText = entries
          .map((e) => (e.completed || e.status === 'completed' ? `- [x] ${e.content}` : `- [ ] ${e.content}`))
          .join('\n');
        return { type: 'plan', content: `${planText}\n\n` };
      }
      return null;
    }

    case 'current_mode_update': {
      return {
        type: 'session_state',
        content: '',
        sessionId: (notification as any).sessionId,
        currentModeId: update.currentModeId,
      };
    }

    case 'config_option_update': {
      if (!Array.isArray(update.configOptions)) {
        return null;
      }
      return {
        type: 'session_state',
        content: '',
        sessionId: (notification as any).sessionId,
        configOptions: update.configOptions,
      };
    }

    case 'available_commands_update': {
      if (!Array.isArray(update.availableCommands)) {
        return null;
      }
      return {
        type: 'session_state',
        content: '',
        sessionId: (notification as any).sessionId,
        availableCommands: update.availableCommands,
      };
    }

    case 'session_info_update': {
      return {
        type: 'session_state',
        content: '',
        sessionId: (notification as any).sessionId,
        ...(update.title !== undefined ? { title: update.title } : {}),
        ...(update.updatedAt !== undefined ? { updatedAt: update.updatedAt } : {}),
      };
    }

    default:
      return null;
  }
}
