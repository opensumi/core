/* eslint-disable no-console */
import { Injectable, Autowired } from '@opensumi/di';
import { CommandService, CommandRegistry, Command, CancellationTokenSource } from '@opensumi/ide-core-common';

import { AiGPTBackSerivcePath } from '../../common';

@Injectable()
export class AiSumiService {
  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistryService: CommandRegistry;

  private cancelIndicator = new CancellationTokenSource();

  private taskPrompt(command: Command[]) {
    return `
In my system, there are some Commands. Through these commands, certain functions can be achieved. Please analyze my question to determine the function I want to implement, and match the appropriate Command.
Please refer to the example Q&A below and return in the format of the example answer. If no suitable command is found, please return 'No suitable command found.'
I will provide all the commands in the system and their descriptions in the format of {command}-{description}. When analyzing the question, please refer to both the command and its description.
Below are all the Commands and their descriptions in the system:
${command.map((c) => `{${c.delegate || c.id}}-{${!!c.labelLocalized?.localized! || c.label}}`).join('\n')}
{workbench.action.openGlobalKeybindings}-{Keybindings}
{editor.action.setEncoding}-{set encoding}`;
  }

  public async message(input: string): Promise<Command | undefined> {
    const commands = this.commandRegistryService
      .getCommands()
      .filter((c) => !!c.labelLocalized?.localized! || c.label);
    const step = 30;
    const partCommands = Array.from({ length: Math.round(commands.length / step) }, (_, index) => index).map((i) =>
      commands.slice(i * step, (i + 1) * step),
    );

    const res = await Promise.all(partCommands.map((c) => this.requestCommand(c, input)));
    const passibleCommands = res.filter((r) => !!r);

    let finalCommand = passibleCommands[0];

    if (passibleCommands.length > 1) {
      finalCommand = await this.requestCommand(passibleCommands as Command[], input);
    }

    return commands.find((c) => c === finalCommand);
  }

  private async requestCommand(commands: Command[], question: string) {
    const cotPrompt = `
${this.taskPrompt(commands)}
提问: 打开全局快捷键配置
回答: 通过分析需求「打开全局快捷键配置」, 可以获取到一些关键词： open、keybinding、global。通过这些关键词可以在 Command 的列表内匹配到相关的命令是： \`workbench.action.openGlobalKeybindings\`
提问: 增加字体大小
回答: 通过分析需求「增加字体大小」，可以获取到一些关键词：font、zoomIn、zoomOut。通过这些关键词，无法在 Command 列表中找到合适的命令。
提问: ${question}`;

    const res = await this.aiBackService.aiAntGlm(cotPrompt, this.cancelIndicator.token);
    const answerCommand = this.matchCommand(res.data);
    return commands.find((c) => (c.delegate || c.id) === answerCommand) || '';
  }

  public cancelAll() {
    this.cancelIndicator.cancel();
  }

  private matchCommand(answer: string): string {
    const commandReg = /`(?<command>\S+)`/;
    const command = commandReg.exec(answer);

    return command ? command.groups?.command || '' : '';
  }
}
