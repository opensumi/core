import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import { AISerivceType, AiGPTBackSerivcePath } from '../../common';

const aiSearchKey = '/search ';
const aiSearchCodeKey = '/searchcode ';
const aiSumiKey = '/sumi';
const aiExplainKey = '/explain';

@Injectable()
export class AiChatService {

  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  private readonly _onChatMessageLaunch = new Emitter<string | React.ReactNode>();
  public readonly onChatMessageLaunch: Event<string | React.ReactNode> = this._onChatMessageLaunch.event;

  public launchChatMessage(message: string | React.ReactNode) {
    this._onChatMessageLaunch.fire(message);
  }

  public async switchAIService(input: string) {
    let type: AISerivceType | undefined;
    let message: string | undefined;

    const currentEditor = this.editorService.currentEditor;
    if (!currentEditor) {
      return;
    }

    const currentUri = currentEditor.currentUri;
    if (!currentUri) {
      return;
    }

    if (input === '解释代码') {
      // 获取指定范围内的文本内容
      const selection = currentEditor.monacoEditor.getSelection();
      if (!selection) {
        return;
      }
      const selectionContent = currentEditor.monacoEditor.getModel()?.getValueInRange(selection);
      const messageWithPrompt = `解释以下这段代码。\n \`\`\`${selectionContent}\`\`\``;

      return { type: AISerivceType.GPT, message: messageWithPrompt };
    }

    if (input.startsWith(aiSumiKey)) {
      type = AISerivceType.Sumi;
      message = input.split(aiSumiKey)[1];

      return { type: AISerivceType.Sumi, message };
    }

    if (input.startsWith(aiExplainKey)) {
      message = input.split(aiExplainKey)[1];
      const displayName = currentUri.displayName;
      const content = currentEditor.monacoEditor.getValue();
      const messageWithPrompt = `我有一个 ${displayName} 文件，代码内容是 \`\`\`\n${content}\n\`\`\`. 此时有个异常问题是 "${message}", 请给我解释这个异常问题并给出修复建议`;

      return { type: AISerivceType.Explain, message: messageWithPrompt };
    }

    return { type: AISerivceType.GPT, message: input };

    // 单独处理 解释代码
    if (input === '解释代码') {
      return { type: AISerivceType.GPT, message: input };
    }

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

  public async messageWithGPT(input: string) {
    const res = await this.aiBackService.aiGPTcompletionRequest(input);
    console.log('messageWithGPT: >>>> ', res);
    return res.data;
  }
}
