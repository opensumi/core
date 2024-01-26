import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  CommandRegistry,
  ILogServiceClient,
  ILoggerManagerClient,
  SupportLogNamespace,
} from '@opensumi/ide-core-common';
import { AiBackSerivcePath, IAiBackService, IAiBackServiceResponse } from '@opensumi/ide-core-common/lib/ai-native';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { AiChatService } from '../ai-chat.service';
import { SumiCommandPromptManager } from '../prompts/sumi.command';

export interface ISumiCommandModelResp {
  type: 'command';
  commandKey: string;
  answer: string;
}

export interface ISumiSettingModelResp {
  type: 'setting';
  settingKey: string;
  answer: string;
}

export interface INullModelResp {
  type: 'null';
  answer: string;
}

export type ISumiModelResp = ISumiCommandModelResp | ISumiSettingModelResp | INullModelResp;

@Injectable()
export class AiSumiService {
  // for split command, too much will out of prompt tokens
  protected commandRequestStep = 50;

  @Autowired(AiBackSerivcePath)
  aiBackService: IAiBackService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistryService: CommandRegistry;

  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  @Autowired(IFileServiceClient)
  protected fileService: IFileServiceClient;

  @Autowired(SumiCommandPromptManager)
  protected promptManager: SumiCommandPromptManager;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  protected logger: ILogServiceClient;

  constructor() {
    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  async requestToModel(prompt: string, model?: string) {
    return this.aiBackService.request(prompt, { model });
  }

  /**
   * 当用户输入 / IDE 后，这个方法负责调用 AI 模型，返回 AI 的回复
   */
  async getModelResp(input: string): Promise<IAiBackServiceResponse<ISumiModelResp>> {
    /**
     * 先直接使用 input 进行 command 的匹配
     */
    const inputMatchedCommand = this.searchWithoutAI(input);

    if (inputMatchedCommand) {
      const { labelLocalized, label, id } = inputMatchedCommand;

      return {
        data: {
          type: 'command',
          commandKey: id,
          answer: `已在系统内找到适合功能: ${labelLocalized?.localized || label}，您可以使用 (\`${id}\`) 命令`,
        },
      };
    }

    // 查询 AI
    const prompt = this.promptManager.findIDECapabilityPrompt(input);
    const modelReply = await this.requestToModel(prompt);

    if (modelReply.errorCode || !modelReply.data) {
      this.logger.error('[agent] IDE agent failed: ', modelReply.errorCode);

      if (!modelReply.errorMsg) {
        modelReply.errorMsg = 'AI 模型调用失败';
      }

      return {
        ...modelReply,
        data: {
          type: 'null',
          answer: modelReply.errorMsg,
        },
      };
    }

    const { data } = modelReply;

    /**
     * 返回的数据一定带有一个 (`{content}`) 这种格式的数据，通过正则将这个字符串匹配出来
     * 这个字符串就是具体的 settingKey 或者 command
     */
    const regex = /(?<=\(`)[^`]+(?=`\))/g;
    const match = data.match(regex);
    const key = match && match[0];

    let sumiData: ISumiModelResp = { type: 'null', answer: data };

    if (key) {
      // 在 command 中查找对应的 key
      if (this.commandRegistryService.getCommand(key)) {
        sumiData = {
          type: 'command',
          commandKey: key,
          answer: data,
        };
      }

      // 在 settings 中查找对应的 key
      if (this.preferenceService.has(key)) {
        sumiData = {
          type: 'setting',
          settingKey: key,
          answer: data,
        };
      }
    }

    return { ...modelReply, data: sumiData };
  }

  private searchWithoutAI(input: string) {
    return this.commandRegistryService
      .getCommands()
      .find((command) => command.labelLocalized?.localized === input || command.label === input);
  }
}
