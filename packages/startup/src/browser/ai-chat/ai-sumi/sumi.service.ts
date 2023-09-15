/* eslint-disable no-console */
import { Injectable, Autowired } from '@opensumi/di';
import { CommandService, CommandRegistry, Command } from '@opensumi/ide-core-common';
import { AiGPTBackSerivcePath } from '../../../common';

@Injectable()
export class AiSumiService {
  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistryService: CommandRegistry;

  private taskPrompt(command: string[]) {
    return `
在我的系统中有一些 Command，通过这些命令可以实现一些功能。请通过分析我的问题，找到我想要实现的功能，匹配适合的 Command。
请参照下面的示例问答，按照示例回答的格式返回。如果找不到合适的命令，请返回未找到合适命令。
以下是系统内的全部 Command: ${command.join('、')}、workbench.action.openGlobalKeybindings、editor.action.setEncoding`;
  }

  public async message(input: string): Promise<Command | undefined> {
    const commands = this.commandRegistryService.getCommands();
    const commandIds = commands.filter((c) => !!c.label).map((c) => c.delegate || c.id);
    const step = 50;
    const partCommands = Array.from({ length: Math.round(commandIds.length / step) }, (_, index) => index).map((i) =>
      commandIds.slice(i * step, (i + 1) * step),
    );

    const res = await Promise.all(partCommands.map((c) => this.requestCommand(c, input)));
    const passibleCommands = res.filter((r) => !!r);

    let finalCommand = passibleCommands[0];

    if (passibleCommands.length > 1) {
      finalCommand = await this.requestCommand(passibleCommands, input);
    }

    return commands.find((c) => c.id === finalCommand || c.delegate === finalCommand);
  }

  private async requestCommand(commands: string[], question: string) {
    const cotPrompt = `
${this.taskPrompt(commands)}
提问: 打开全局快捷键配置
回答: 通过分析需求「打开全局快捷键配置」, 可以获取到一些关键词： open、keybinding、global。通过这些关键词可以在 Command 的列表内匹配到相关的命令是： \`workbench.action.openGlobalKeybindings\`
提问: 增加字体大小
回答: 通过分析需求「增加字体大小」，可以获取到一些关键词：font、zoomIn、zoomOut。通过这些关键词，无法在 Command 列表中找到合适的命令。
提问: ${question}`;

    const res = await this.aiBackService.aiAntGlm(cotPrompt);
    const answerCommand = this.matchCommand(res.data);
    return commands.find((c) => c === answerCommand) || '';
  }

  private matchCommand(answer: string): string {
    const commandReg = /`(?<command>\S+)`/;
    const command = commandReg.exec(answer);

    return command ? command.groups?.command || '' : '';
  }
}
