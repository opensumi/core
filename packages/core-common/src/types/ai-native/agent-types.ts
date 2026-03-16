/**
 * ACP Agent Type Definitions
 * Centralized configuration for supported CLI agents
 */

// ACP Agent 类型
export type ACPAgentType = 'qwen' | 'claude-agent-acp';

// Default agent type
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

// Agent configuration presets
export const AGENT_CONFIGS: Record<ACPAgentType, AgentConfig> = {
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
 */
export function getAgentConfig(agentType: ACPAgentType): AgentConfig {
  return AGENT_CONFIGS[agentType] || AGENT_CONFIGS[DEFAULT_AGENT_TYPE];
}

/**
 * Check if an agent type is supported
 */
export function isSupportedAgentType(type: string): type is ACPAgentType {
  return type in AGENT_CONFIGS;
}

/**
 * Get list of all supported agent types
 */
export function getSupportedAgentTypes(): ACPAgentType[] {
  return Object.keys(AGENT_CONFIGS) as ACPAgentType[];
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
