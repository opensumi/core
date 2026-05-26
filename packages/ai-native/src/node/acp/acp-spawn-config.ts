import * as path from 'node:path';

import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';

/**
 * Pure function: resolve AgentProcessConfig + node-local information into
 * final spawn parameters. No IO, no side effects.
 */
export function resolveAgentSpawnConfig(input: {
  config: AgentProcessConfig;
  processEnv: NodeJS.ProcessEnv;
  processExecPath: string;
}): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  // 1. nodePath: env var escape hatch > preference > process.execPath
  const nodePath = input.processEnv.SUMI_ACP_NODE_PATH || input.config.nodePath || input.processExecPath;

  // 1a. Absolute path validation (fail-fast)
  if (!path.isAbsolute(nodePath)) {
    throw new Error(
      `nodePath must be an absolute path, got: "${nodePath}". ` +
        'Set ai-native.acp.nodePath or SUMI_ACP_NODE_PATH to an absolute path.',
    );
  }

  const nodeBinDir = path.dirname(nodePath);

  // 2. command: env var escape hatch > browser-resolved value
  const command = input.processEnv.SUMI_ACP_AGENT_PATH || input.config.command;

  // 3. Final env: process + merged env + forced NODE/PATH
  const envFromConfig: Record<string, string> = {};
  for (const v of input.config.env ?? []) {envFromConfig[v.name] = v.value;}

  const env: Record<string, string> = {
    ...input.processEnv,
    ...envFromConfig,
    NODE: path.join(nodeBinDir, 'node'),
    PATH: `${nodeBinDir}${path.delimiter}${input.processEnv.PATH ?? ''}`,
  };

  return { command, args: input.config.args, env };
}
