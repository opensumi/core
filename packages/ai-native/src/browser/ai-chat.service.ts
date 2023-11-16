import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { CancellationTokenSource, Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import {
  AISerivceType,
  AiBackSerivcePath,
  IAiBackService,
  IAiBackServiceResponse,
  IAiBackServiceOption,
  IChatMessageStructure,
  InstructionEnum,
} from '../common';

import { MsgStreamManager } from './model/msg-stream-manager';

export interface IAiSearchResponse extends IAiBackServiceResponse {
  answer?: string;
}

export interface IAiStreamMessageService<T extends IAiBackServiceResponse<string>> extends IAiBackService<T> {
  destroyStreamRequest?: (sessionId: string) => Promise<void>;
}

@Injectable()
export class AiChatService extends Disposable {
  @Autowired(AiBackSerivcePath)
  public aiBackService: IAiStreamMessageService<IAiSearchResponse>;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(MsgStreamManager)
  private readonly msgStreamManager: MsgStreamManager;

  private readonly _onChatMessageLaunch = new Emitter<IChatMessageStructure>();
  public readonly onChatMessageLaunch: Event<IChatMessageStructure> = this._onChatMessageLaunch.event;

  private readonly _onChangeSessionId = new Emitter<string>();
  public readonly onChangeSessionId: Event<string> = this._onChangeSessionId.event;

  private readonly _onInlineChatVisible = new Emitter<boolean>();
  public readonly onInlineChatVisible: Event<boolean> = this._onInlineChatVisible.event;

  private _latestSessionId: string;
  public get latestSessionId(): string {
    return this._latestSessionId;
  }

  private get currentEditor() {
    return this.editorService.currentEditor;
  }

  public launchChatMessage(data: IChatMessageStructure) {
    this._onChatMessageLaunch.fire(data);
  }

  public launchInlineChatVisible(value: boolean) {
    this._onInlineChatVisible.fire(value);
  }

  public cancelIndicator = new CancellationTokenSource();
  public cancelIndicatorChatView = new CancellationTokenSource();

  public cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  public cancelChatViewToken() {
    this.cancelIndicatorChatView.cancel();
    this.cancelIndicatorChatView = new CancellationTokenSource();
  }

  public async destroyStreamRequest(sessionId: string) {
    if (this.aiBackService.destroyStreamRequest) {
      await this.aiBackService.destroyStreamRequest(sessionId);
      this.msgStreamManager.sendDoneStatue();
    }
  }

  public async switchAIService(input: string, prompt = '') {
    let type: AISerivceType | undefined = AISerivceType.GPT;
    let message: string | undefined = prompt || input;

    if (input.startsWith(InstructionEnum.aiSumiKey)) {
      type = AISerivceType.Sumi;
      message = input.split(InstructionEnum.aiSumiKey)[1];

      return { type, message };
    }

    if (input.startsWith(InstructionEnum.aiExplainKey)) {
      type = AISerivceType.Explain;
      message = input.split(InstructionEnum.aiExplainKey)[1];

      if (!prompt) {
        prompt = this.explainCodePrompt(message);
      }

      return { type, message: prompt };
    }

    if (input.startsWith(InstructionEnum.aiRunKey)) {
      return { type: AISerivceType.Run, message: prompt };
    }

    if (input.startsWith(InstructionEnum.aiSearchDocKey)) {
      type = AISerivceType.SearchDoc;
      message = input.split(InstructionEnum.aiSearchDocKey)[1];

      return { type, message };
    }

    if (input.startsWith(InstructionEnum.aiSearchCodeKey)) {
      type = AISerivceType.SearchCode;
      message = input.split(InstructionEnum.aiSearchCodeKey)[1];

      return { type, message };
    }

    return { type, message };
  }

  // 解释当前文件的代码或者选中的某个代码片段的 prompt，也可以用于对选中的代码加上用户的描述进行解释
  public explainCodePrompt(message = ''): string {
    if (!this.currentEditor) {
      return '';
    }

    const currentUri = this.currentEditor.currentUri;
    if (!currentUri) {
      return '';
    }

    const displayName = currentUri.displayName;
    const fsPath = currentUri.codeUri.fsPath;
    const content = this.currentEditor.monacoEditor.getValue();
    const selectionContent =
      this.currentEditor.monacoEditor.getModel()?.getValueInRange(this.currentEditor.monacoEditor.getSelection()!) ||
      '';
    let messageWithPrompt = '';

    /**
     * 分三种情况
     * 1. 没打开任意一个文件，则提供当前文件目录树给出当前项目的解释。如果用户有 prompt，则在最后带上
     * 2. 没选中任意代码，则解释当前打开的代码文件（文件路径、代码）
     * 3. 选中任意代码，则带上当前文件信息（文件路径、代码）和选中片段
     * 4. 打开当前文件，用户如果有 prompt，则在最后带上。此时如果有选中代码片段，则带上，没有则带上文件代码
     */
    if (!this.currentEditor || !this.currentEditor.currentUri) {
      //
    }

    if (!selectionContent) {
      messageWithPrompt = `这是 ${displayName} 文件, 位置是在 ${fsPath}, 代码内容是 \`\`\`\n${content}\n\`\`\`。向我解释这个代码内容的意图`;
    }

    if (selectionContent) {
      messageWithPrompt = `这是 ${displayName} 文件, 位置是在 ${fsPath}, 解释一下这段代码的意图: \`\`\`${selectionContent} \`\`\``;
    }

    if (message.trim()) {
      if (selectionContent) {
        messageWithPrompt = `这是 ${displayName} 文件，我会提供给你代码片段以及我的问题, 你需要根据我给的代码片段来解释我的问题。我提供的代码片段是: \`\`\`\n${selectionContent}\n\`\`\`，我的问题是: "${message}" `;
      } else {
        messageWithPrompt = `这是 ${displayName} 文件，代码内容是 \`\`\`\n${content}\n\`\`\`。根据我提供的代码内容来回答我的问题，我的问题是: "${message}" `;
      }
    }
    return messageWithPrompt;
  }

  public opensumiRolePrompt(message: string): string {
    const withPrompt = message;
    return withPrompt;
  }

  /**
   * by backend service
   * @param message
   */
  public onMessage(message: string) {
    try {
      const msgObj = JSON.parse(message);

      if (msgObj.id && msgObj.choices) {
        const { id, choices } = msgObj;
        this.msgStreamManager.recordMessage(id, choices[0]);
      } else {
        this.msgStreamManager.sendErrorStatue();
      }
    } catch (error) {
      new Error(`onMessage error: ${error}`);
    }
  }

  public async messageWithStream(input: string, options: IAiBackServiceOption = {}, sessionId: string): Promise<void> {
    this.msgStreamManager.setCurrentSessionId(sessionId);
    this.msgStreamManager.sendThinkingStatue();

    await this.aiBackService.requestStream(
      input,
      {
        ...options,
        sessionId,
      },
      this.cancelIndicatorChatView.token,
    );
  }

  public async message(input: string, options: IAiBackServiceOption = {}) {
    const res = await this.aiBackService.request(input, options, this.cancelIndicatorChatView.token);

    if (res.isCancel) {
      return null;
    }

    if (res.errorCode !== 0) {
      return res.errorMsg || '';
    } else {
      return res.data || '';
    }
  }

  public async searchDoc(input: string, sessionId: string) {
    return this.messageWithStream(input, { type: 'searchDoc' }, sessionId);
  }

  public async searchCode(input: string, sessionId: string) {
    return this.messageWithStream(input, { type: 'searchCode' }, sessionId);
  }

  public setLatestSessionId(id: string): void {
    this._latestSessionId = id;
    this._onChangeSessionId.fire(id);
  }
}
