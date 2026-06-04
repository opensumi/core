/**
 * ACP Agent Type Definitions
 * Centralized configuration for supported CLI agents
 */

import type { EnvVariable, McpServer } from './acp-types';

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
 * Field names and env structure are aligned with @agentclientprotocol/sdk conventions.
 */
export interface AgentProcessConfig {
  /**
   * Stable agent identifier (e.g., 'claude-agent-acp').
   * Used for per-agent preference lookup and diagnostics.
   */
  agentId: string;
  /**
   * CLI command to start the agent (already resolved by browser).
   */
  command: string;
  /**
   * Arguments passed to the agent.
   */
  args: string[];
  /**
   * Working directory (absolute path).
   * Named `cwd` to match ACP SDK CreateTerminalRequest.
   */
  cwd: string;
  /**
   * Environment variables for the agent process.
   * Structure matches ACP SDK EnvVariable (array of {name, value}).
   */
  env?: EnvVariable[];
  /**
   * Node.js executable path from preference. Node layer continues fallback.
   */
  nodePath?: string;
  /**
   * MCP servers to pass into ACP session/new, session/load, and related session operations.
   */
  mcpServers?: McpServer[];
  /**
   * OpenSumi built-in WebMCP exposure options for ACP sessions.
   */
  webMcp?: {
    enabled?: boolean;
  };
  /**
   * Maximum number of reusable ACP agent threads.
   */
  threadPoolSize?: number;
  /**
   * Default ACP session model id to apply after session creation/loading.
   */
  defaultModel?: string;
  /**
   * Default ACP session mode id to apply after session creation/loading.
   */
  defaultMode?: string;
  /**
   * Default ACP session config option values keyed by config option id.
   */
  defaultConfigOptions?: Record<string, string | boolean>;
}

/**
 * DI Token for ACP config provider.
 * Allows downstream projects to customize AgentProcessConfig construction
 * (e.g., inject custom env vars, override command paths, add validation).
 */
export const IACPConfigProvider = Symbol('IACPConfigProvider');

export { EnvVariable } from './acp-types';

export interface IACPConfigProvider {
  /**
   * Build the AgentProcessConfig for ACP operations.
   * Called by ACPSessionProvider and AcpChatAgent before any agent operation.
   * Implementations can customize command, args, workspaceDir, env, etc.
   * Should throw if prerequisites are not met (e.g., missing API key).
   */
  resolveConfig(): Promise<AgentProcessConfig>;
}
