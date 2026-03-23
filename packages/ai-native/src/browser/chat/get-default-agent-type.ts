import { PreferenceService } from '@opensumi/ide-core-browser';
import { ACPAgentType, AgentConfig, DEFAULT_AGENT_TYPE } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

export const DEFAULT_AGENT_CONFIGS: Record<ACPAgentType, AgentConfig> = {
  qwen: {
    command: 'qwen',
    args: ['--acp', '--channel=ACP', '--input-format=stream-json', '--output-format=stream-json'],
    streaming: true,
    description: 'Qwen CLI Agent',
  },
  'claude-agent-acp': {
    command: 'claude-agent-acp',
    args: [],
    streaming: true,
    description: 'Claude Code ACP Agent',
  },
};

/**
 * Get the default agent type from user preferences
 */
export function getDefaultAgentType(preferenceService: PreferenceService): ACPAgentType {
  return preferenceService.get<ACPAgentType>('ai.native.agent.defaultType', DEFAULT_AGENT_TYPE);
}

/**
 * Get agent config (command + args) for a given type, preferring user preferences over defaults
 */
export function getAgentConfig(preferenceService: PreferenceService, agentType: ACPAgentType): AgentConfig {
  const configs = preferenceService.get<Record<string, AgentConfig>>(AINativeSettingSectionsId.AgentConfigs, {});
  return configs[agentType] || DEFAULT_AGENT_CONFIGS[agentType];
}
