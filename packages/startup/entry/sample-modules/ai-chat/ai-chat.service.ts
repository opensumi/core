import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event, CommandService } from '@opensumi/ide-core-common';
import { ExtensionManagementService } from '@opensumi/ide-extension/lib/browser/extension-management.service';
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

  @Autowired()
  protected extensionManagementService: ExtensionManagementService;

  private readonly _onChatMessageLaunch = new Emitter<string | React.ReactNode>();
  public readonly onChatMessageLaunch: Event<string | React.ReactNode> = this._onChatMessageLaunch.event;

  public launchChatMessage(message: string | React.ReactNode) {
    this._onChatMessageLaunch.fire(message);
  }

  public async switchAIService(input: string) {
    let type: AISerivceType | undefined;
    let message: string | undefined;

    const messageWithPrompt = `我会给你一段话，你需要分析并推理出这段话属于以下哪个分类的 tag 里，并返回 tag 的名字给我，tags 的列表有['文本搜索', '代码搜索', 'sumi']。
    例如：“java 生成质数”、“找出所有 markdown 的正则表达式” 等和代码搜索意图强相关的，则返回 '代码搜索'。
    例如：“java 如何生成质数？”、“log4j 官方文档” 等和文本搜索意图强相关的，则返回 '文本搜索'。
    例如：“打开 quick open”、“切换主题” 等和 IDE 有关的交互内容，则返回 'sumi'。
    我给你的这段话是 "${input}"。
    请按照以下格式返回结果：{"tag": "xxx"}`;

    const antglmType = await this.aiBackService.aiAntGlm(messageWithPrompt);

    console.log('antglm result:>>> ', antglmType);

    if (antglmType && antglmType.data) {
      try {
        const toJson = JSON.parse(antglmType.data);
        if (toJson && toJson.tag) {
          const tag = toJson.tag;

          // @ts-ignore
          if (tag === '文本搜索') {
            type = AISerivceType.Search;
            message = input;
          } else if (tag === '代码搜索') {
            type = AISerivceType.SearchCode;
            message = input;
          } else if (tag === 'sumi') {
            type = AISerivceType.Sumi;
            message = input;
          }
        }
      } catch (error) {
        type = AISerivceType.Sumi;
        message = input;
      }
    }

    // if (input.startsWith(aiSearchKey)) {
    //   type = AISerivceType.Search;
    //   message = input.split(aiSearchKey)[1];
    // } else if (input.startsWith(aiSearchCodeKey)) {
    //   type = AISerivceType.SearchCode;
    //   message = input.split(aiSearchCodeKey)[1];
    // } else if (input.startsWith(aiSumiKey)) {
    //   type = AISerivceType.Sumi;
    //   message = input.split(aiSumiKey)[1];
    // }

    return { type, message };
  }

  public async messageWithSumi(input: string) {
    // const messageWithPrompt = `You are a developer proficient in vscode extension development.I will ask you some questions about extension development.
    // If a certain problem can be solved using a Command, please provide the command.
    // If it's related to modifying configurations, please specify the category and identifier of the configuration item, along with an example code.
    // An example question is as follow: “修改字体大小为 20 像素”.
    // And then, give me an answer such as: “
    // ConfigCategory: editor
    // ConfigKey: fontSize
    // ConfigParams: 16
    // Example:
    // \`\`\`
    // const config = vscode.workspace.getConfiguration('editor');
    // config.update('fontSize', 16, vscode.ConfigurationTarget.Global);
    // \`\`\`
    // ”
    // Another example is : “唤起弹窗”
    // And answer such as :”
    // Command: workbench.action.openGlobalKeybindings
    // Example:
    // \`\`\`
    // vscode.workspace.executeCommand('workbench.action.openGlobalKeybindings')
    // \`\`\`
    // ”
    // (You need to distinguish between whether it's a Command or a Config in your answers and provide the corresponding format. Simply provide content similar to the examples given without the need for explanations.)
    // My question is: ${input}`;
    const messageWithPrompt = `
    You are a professional vscode plugin developer, and I have some questions about plugin development to ask you. Please provide API and give example codes with javascript.
    An example question is as follow: "修改字体大小为 20 像素"
    And then, give me an answer such as: "
      API: vscode.workspace.getConfiguration
      Example:
      \`\`\`
          const config = vscode.workspace.getConfiguration('editor');
          config.update('fontSize', 20, vscode.ConfigurationTarget.Global);
      \`\`\`
    "
    (Please just provide example code and API, do not give other words)
    My question is: ${input}`;

    const res = await this.aiBackService.aiGPTcompletionRequest(messageWithPrompt);

    console.log('aiCodeGPTcompletionRequest: >>>> ', res);

    const exampleReg = /(Example:)?\n*```(javascript)?\n?(?<example>[\s\S]+)```/i;
    const example = exampleReg.exec(res.data);
    if (example) {
      try {
        await this.aiBackService.writeFile(example.groups?.example);
        await this.extensionManagementService.postChangedExtension(false, await this.aiBackService.getExtensionPath());
      } catch {
        console.log('error');
      }
    }

    // const commandReg = /Command:\s*(?<command>\S+)\s*\n*Example:\s*```\n?(?<example>[\s\S]+)\n```/i;
    // const command = commandReg.exec(res.data);
    // if (command) {
    //   try {
    //     await this.commandService.executeCommand(command.groups?.command!);
    //   } catch {
    //     await this.aiBackService.writeFile(command.groups?.example);
    //     await this.extensionManagementService.postChangedExtension(false, await this.aiBackService.getExtensionPath());
    //   }
    // }

    // const configReg = /ConfigCategory:\s*(?<category>\S+)\s*\n*ConfigKey:\s*(?<key>\S+)\s*\n*ConfigParams:\s*"?(?<params>[^"\n]+)"?\s*\n*Example:\s*\n*```(?<example>[^`]+)```/i;
    // const config = configReg.exec(res.data);
    // if (config) {
    //   const { category, key, params, example } = config.groups || {};
    //   this.preferenceService.set(`${category}.${key}`, params);
    //   await this.aiBackService.writeFile(example);
    //   await this.extensionManagementService.postChangedExtension(false, await this.aiBackService.getExtensionPath());
    // }
    setTimeout(() => {
      this.removeOldExtension();
    }, 10000);
  }

  public async removeOldExtension() {
    await this.extensionManagementService.postUninstallExtension(await this.aiBackService.getExtensionPath());
  }
}
