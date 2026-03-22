/**
 * ACP Agent Type Definitions
 * Centralized configuration for supported CLI agents
 */

// ACP Agent 类型
export type ACPAgentType = 'qwen' | 'claude-agent-acp';

// Default agent type (fallback when no preference is set)
export const DEFAULT_AGENT_TYPE: ACPAgentType = 'claude-agent-acp';

// Supported agent types
export enum ACPAgentTypeEnum {
  Qwen = 'qwen',
  ClaudeCodeACP = 'claude-agent-acp',
}

// Agent configuration preset
export interface AgentConfig {
  /**
   * CLI command to start the agent
   */
  command: string;

  /**
   * Arguments passed to the agent
   */
  args: string[];

  /**
   * Whether this agent supports streaming
   */
  streaming?: boolean;

  /**
   * Agent description for UI display
   */
  description?: string;
}

// Default agent configurations
const DEFAULT_AGENT_CONFIGS: Record<ACPAgentType, AgentConfig> = {
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
 * Get agent configuration for a given type
 * @param agentType - The agent type to get configuration for
 * @param preferenceService - Optional preference service to read custom configs
 */
export function getAgentConfig(
  agentType: ACPAgentType,
  preferenceService?: { get<T>(key: string, defaultValue?: T): T | undefined },
): AgentConfig {
  // Try to get custom config from preferences
  const customConfigs = preferenceService?.get<Partial<Record<ACPAgentType, AgentConfig>>>(
    'ai.native.agent.configs',
    {},
  );

  if (customConfigs && agentType in customConfigs) {
    const customConfig = customConfigs[agentType];
    // Merge with default config to ensure all fields exist
    const defaultConfig = DEFAULT_AGENT_CONFIGS[agentType];
    if (defaultConfig && customConfig) {
      return { ...defaultConfig, ...customConfig };
    }
    if (customConfig) {
      return customConfig as AgentConfig;
    }
  }

  // Return default config for the agent type
  return DEFAULT_AGENT_CONFIGS[agentType];
}

/**
 * Check if an agent type is supported
 */
export function isSupportedAgentType(type: string): type is ACPAgentType {
  return type === 'qwen' || type === 'claude-agent-acp';
}

/**
 * Get list of all supported agent types
 */
export function getSupportedAgentTypes(): ACPAgentType[] {
  return ['qwen', 'claude-agent-acp'];
}

/**
 * Configuration for spawning and running the ACP CLI agent process.
 * Used to initialize the agent connection and process, not to configure individual sessions.
 */
export interface AgentProcessConfig {
  agentType: ACPAgentType;
  workspaceDir: string;
  env?: Record<string, string>;
  enablePermissionConfirmation?: boolean;
}
