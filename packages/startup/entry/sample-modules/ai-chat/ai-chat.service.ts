import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event, CommandService } from '@opensumi/ide-core-common';
import { AISerivceType, AiGPTBackSerivcePath } from '@opensumi/ide-startup/lib/common/index';

const aiSearchKey = '/search ';
const aiSearchCodeKey = '/searchcode ';
const aiSumiKey = '/sumi';

@Injectable()
export class AiChatService {

  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  private readonly _onChatMessageLaunch = new Emitter<string | React.ReactNode>();
  public readonly onChatMessageLaunch: Event<string | React.ReactNode> = this._onChatMessageLaunch.event;

  public launchChatMessage(message: string | React.ReactNode) {
    this._onChatMessageLaunch.fire(message);
  }

  public switchAIService(input: string) {
    let type: AISerivceType | undefined;
    let message: string | undefined;

    if (input.startsWith(aiSearchKey)) {
      type = AISerivceType.Search;
      message = input.split(aiSearchKey)[1];
    } else if (input.startsWith(aiSearchCodeKey)) {
      type = AISerivceType.SearchCode;
      message = input.split(aiSearchCodeKey)[1];
    } else if (input.startsWith(aiSumiKey)) {
      type = AISerivceType.Sumi;
      message = input.split(aiSumiKey)[1];
    }

    return { type, message };
  }

  public async messageWithSumi(input: string) {
    const messageWithPrompt = `You are a developer proficient in vscode extension development. I will ask you some questions about extension development. If a certain problem can be solved using a Command, please provide the command. If it's related to modifying configurations, please specify the category and identifier of the configuration item, along with an example code.
    An example question is as follow: “修改字体大小为 20 像素”.
    And then, give me an answer such as: “
    ConfigCategory: editor
    ConfigKey: fontSize
    ConfigParams: 16
    Example:
    \`\`\`
    const config = vscode.workspace.getConfiguration('editor');
    config.update('fontSize', 16, vscode.ConfigurationTarget.Global);
    \`\`\`
    ”
    Another example is : “唤起弹窗”
    And answer such as :”
    Command: workbench.action.openGlobalKeybindings
    Example:
    \`\`\`
    vscode.workspace.executeCommand('workbench.action.openGlobalKeybindings')
    \`\`\`
    ”
    (You need to distinguish between whether it's a Command or a Config in your answers and provide the corresponding format. Simply provide content similar to the examples given without the need for explanations.)
    My question is: ${input}`;

    const res = await this.aiBackService.aiCommonRequest(messageWithPrompt);

    const commandReg = /Command:\s*(?<command>\S+)\s*\n*Example:\s*```(?<example>[\s\S]+)```/i;
    const command = commandReg.exec(res);
    if (command) {
      this.commandService.tryExecuteCommand(command.groups?.command!);
    }

    const configReg = /ConfigCategory:\s*(?<category>\S+)\s*\n*ConfigKey:\s*(?<key>\S+)\s*\n*ConfigParams:\s*"?(?<params>[^"\n]+)"?\s*\n*Example:\s*\n*```(?<example>[\s\S]+)```/i;
    const config = configReg.exec(res);
    if (config) {
      const { category, key, params } = config.groups || {};
      this.preferenceService.set(`${category}.${key}`, params);
    }
  }
}
