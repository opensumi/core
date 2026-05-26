import { EnvVariable } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';

/**
 * Pure function: merge agent registration defaults with user preferences
 * into the final AgentProcessConfig. Called on browser side before RPC.
 */
export function buildAcpAgentProcessConfig(input: {
  agentId: string;
  registration: {
    command: string;
    args: string[];
    env?: EnvVariable[];
    cwd: string;
  };
  userPreferences: {
    nodePath: string;
    agents: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
  };
}): AgentProcessConfig {
  const override = input.userPreferences.agents[input.agentId] ?? {};
  return {
    agentId: input.agentId,
    command: override.command ?? input.registration.command,
    args: override.args ?? input.registration.args,
    env: mergeEnv(input.registration.env, override.env),
    cwd: input.registration.cwd,
    nodePath: input.userPreferences.nodePath || undefined,
  };
}

function mergeEnv(base?: EnvVariable[], override?: Record<string, string>): EnvVariable[] | undefined {
  if (!base && !override) {return undefined;}
  const map = new Map<string, string>();
  for (const v of base ?? []) {map.set(v.name, v.value);}
  for (const [k, v] of Object.entries(override ?? {})) {map.set(k, v);}
  return Array.from(map, ([name, value]) => ({ name, value }));
}
