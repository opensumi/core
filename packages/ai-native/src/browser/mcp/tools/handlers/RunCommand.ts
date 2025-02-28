import z from 'zod';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { ITerminalController, ITerminalGroupViewService } from '@opensumi/ide-terminal-next';
import { Deferred } from '@opensumi/ide-utils/lib/promises';

import { MCPLogger } from '../../../types';

const color = {
  italic: '\x1b[3m',
  reset: '\x1b[0m',
};

export const inputSchema = z.object({
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

@Injectable()
export class RunCommandHandler {
  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(ITerminalGroupViewService)
  protected readonly terminalView: ITerminalGroupViewService;

  private approvalDeferredMap = new Map<string, Deferred<boolean>>();

  private terminalId = 0;

  getShellLaunchConfig(command: string) {
    return {
      name: `MCP:Terminal_${this.terminalId++}`,
      cwd: this.appConfig.workspaceDir,
      args: ['-c', command],
    };
  }

  async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    logger.appendLine(`Executing command: ${args.command}`);
    if (args.require_user_approval) {
      const def = new Deferred<boolean>();
      this.approvalDeferredMap.set(args.toolCallId, def);
      const approval = await def.promise;
      if (!approval) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: 'User rejection',
            },
          ],
        };
      }
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
        type: 'text',
        text: e.data.toString(),
      });
    });

    terminalClient.onExit((e) => {
      const isError = e.code !== 0;
      def.resolve({
        isError,
        content: result,
      });

      logger.appendLine(`Command ${args.command} finished with exit code: ${e.code}`);
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

  handleApproval(callId: string, approval: boolean) {
    if (!this.approvalDeferredMap.has(callId)) {
      return;
    }

    const def = this.approvalDeferredMap.get(callId);
    def?.resolve(approval);
  }
}
