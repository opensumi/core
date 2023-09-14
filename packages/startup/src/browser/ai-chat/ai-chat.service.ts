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

export interface IChatMessageStructure {
  message: string | React.ReactNode;
  prompt?: string
}

@Injectable()
export class AiChatService {

  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  private readonly _onChatMessageLaunch = new Emitter<IChatMessageStructure>();
  public readonly onChatMessageLaunch: Event<IChatMessageStructure> = this._onChatMessageLaunch.event;

  public launchChatMessage(data: IChatMessageStructure) {
    this._onChatMessageLaunch.fire(data);
  }

  public async switchAIService(input: string, prompt: string = '') {
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
      let messageWithPrompt: string = '';

      if (!message.trim()) {
        message = currentEditor.monacoEditor.getModel()?.getValueInRange(currentEditor.monacoEditor.getSelection()!);

        messageWithPrompt = `这是 ${displayName} 文件，代码内容是 \`\`\`\n${content}\n\`\`\`。我会给你一段代码片段，你需要给我解释这段代码片段的意思。我的代码片段是: \`\`\`\n${message}\n\`\`\` `;
      } else {
        messageWithPrompt = `这是 ${displayName} 文件，代码内容是 \`\`\`\n${content}\n\`\`\`。此时有个异常问题是 "${message}", 请给我解释这个异常问题并给出修复建议`;
      }

      console.log('ai explain prompt: >>> ', messageWithPrompt)

      return { type: AISerivceType.Explain, message: messageWithPrompt };
    }

    if (input.startsWith(aiSearchKey)) {
      type = AISerivceType.Search;
      message = input.split(aiSearchKey)[1];
    } else if (input.startsWith(aiSearchCodeKey)) {
      type = AISerivceType.SearchCode;
      message = input.split(aiSearchCodeKey)[1];
    } else {
      type = AISerivceType.GPT;
      message = input;
    }

    return { type, message };
  }

  public async messageWithGPT(input: string) {
    const res = await this.aiBackService.aiGPTcompletionRequest(input);
    console.log('messageWithGPT: >>>> ', res);
    return res.data;
  }
}
