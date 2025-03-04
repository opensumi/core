import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { Deferred, Domain } from '@opensumi/ide-core-common';
import { ITerminalController, ITerminalGroupViewService } from '@opensumi/ide-terminal-next/lib/common/controller';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { TerminalToolComponent } from './components/Terminal';
import { RunCommandHandler, inputSchema } from './handlers/RunCommand';

@Domain(MCPServerContribution)
export class RunTerminalCommandTool implements MCPServerContribution {
  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(ITerminalGroupViewService)
  protected readonly terminalView: ITerminalGroupViewService;

  @Autowired(RunCommandHandler)
  private readonly runCommandHandler: RunCommandHandler;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
    registry.registerToolComponent('run_terminal_cmd', TerminalToolComponent);
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'run_terminal_cmd',
      label: 'Run Command',
      description:
        "PROPOSE a command to run on behalf of the user.\nIf you have this tool, note that you DO have the ability to run commands directly on the USER's system.\n\nAdhere to these rules:\n1. Based on the contents of the conversation, you will be told if you are in the same shell as a previous step or a new shell.\n2. If in a new shell, you should `cd` to the right directory and do necessary setup in addition to running the command.\n3. If in the same shell, the state will persist, no need to do things like `cd` to the same directory.\n4. For ANY commands that would use a pager, you should append ` | cat` to the command (or whatever is appropriate). You MUST do this for: git, less, head, tail, more, etc.\n5. For commands that are long running/expected to run indefinitely until interruption, please run them in the background. To run jobs in the background, set `is_background` to true rather than changing the details of the command.\n6. Dont include any newlines in the command.",
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    return this.runCommandHandler.handler(args, logger);
  }
}
