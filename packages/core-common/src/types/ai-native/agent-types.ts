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
  /**
   * CLI command to start the agent
   */
  command: string;
  /**
   * Arguments passed to the agent
   */
  args: string[];
  workspaceDir: string;
  env?: Record<string, string>;
  enablePermissionConfirmation?: boolean;
}
