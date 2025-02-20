import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { Deferred, Domain } from '@opensumi/ide-core-common';
import { ITerminalController, ITerminalGroupViewService } from '@opensumi/ide-terminal-next/lib/common/controller';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

const color = {
  italic: '\x1b[3m',
  reset: '\x1b[0m',
};

const inputSchema = z.object({
  command: z.string().describe('The terminal command to execute'),
  is_background: z.boolean().describe('Whether the command should be run in the background'),
  explanation: z
    .string()
    .describe('One sentence explanation as to why this command needs to be run and how it contributes to the goal.'),
  require_user_approval: z
    .boolean()
    .describe(
      "Whether the user must approve the command before it is executed. Only set this to false if the command is safe and if it matches the user's requirements for commands that should be executed automatically.",
    ),
});

@Domain(MCPServerContribution)
export class RunTerminalCommandTool implements MCPServerContribution {
  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(ITerminalGroupViewService)
  protected readonly terminalView: ITerminalGroupViewService;

  private terminalId = 0;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'run_terminal_cmd',
      description:
        "PROPOSE a command to run on behalf of the user.\nIf you have this tool, note that you DO have the ability to run commands directly on the USER's system.\n\nAdhere to these rules:\n1. Based on the contents of the conversation, you will be told if you are in the same shell as a previous step or a new shell.\n2. If in a new shell, you should `cd` to the right directory and do necessary setup in addition to running the command.\n3. If in the same shell, the state will persist, no need to do things like `cd` to the same directory.\n4. For ANY commands that would use a pager, you should append ` | cat` to the command (or whatever is appropriate). You MUST do this for: git, less, head, tail, more, etc.\n5. For commands that are long running/expected to run indefinitely until interruption, please run them in the background. To run jobs in the background, set `is_background` to true rather than changing the details of the command.\n6. Dont include any newlines in the command.",
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  getShellLaunchConfig(command: string) {
    return {
      name: `MCP:Terminal_${this.terminalId++}`,
      cwd: this.appConfig.workspaceDir,
      args: ['-c', command],
    };
  }

  private async handler(args: z.infer<typeof inputSchema>, logger: MCPLogger) {
    if (args.require_user_approval) {
      // FIXME: support approval
    }

    const terminalClient = await this.terminalController.createTerminalWithWidget({
      config: this.getShellLaunchConfig(args.command),
      closeWhenExited: false,
    });

    this.terminalController.showTerminalPanel();

    const result: { type: string; text: string }[] = [];
    const def = new Deferred<{ isError?: boolean; content: { type: string; text: string }[] }>();

    terminalClient.onOutput((e) => {
      result.push({
        type: 'output',
        text: e.data.toString(),
      });
    });

    terminalClient.onExit((e) => {
      const isError = e.code !== 0;
      def.resolve({
        isError,
        content: result,
      });

      terminalClient.term.writeln(
        `\n${color.italic}> Command ${args.command} executed successfully. Terminal will close in ${
          3000 / 1000
        } seconds.${color.reset}\n`,
      );

      setTimeout(() => {
        terminalClient.dispose();
        this.terminalView.removeWidget(terminalClient.id);
      }, 3000);
    });

    return def.promise;
  }
}
