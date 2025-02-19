import { Autowired, Injectable } from '@opensumi/di';
import { ChatResponseModel } from '@opensumi/ide-ai-native/lib/browser/chat/chat-model';
import { ChatProxyService } from '@opensumi/ide-ai-native/lib/browser/chat/chat-proxy.service';
import { BaseApplyService } from '@opensumi/ide-ai-native/lib/browser/mcp/base-apply.service';
import {
  AIBackSerivcePath,
  AINativeSettingSectionsId,
  ChatMessageRole,
  IAIBackService,
  IApplicationService,
  IChatProgress,
  PreferenceService,
  URI,
  path,
  uuid,
} from '@opensumi/ide-core-browser';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';
import { Range } from '@opensumi/monaco-editor-core';

@Injectable()
export class ApplyService extends BaseApplyService {
  @Autowired(IEditorDocumentModelService)
  private readonly modelService: IEditorDocumentModelService;

  @Autowired(IApplicationService)
  private readonly applicationService: IApplicationService;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  protected async doApply(
    relativePath: string,
    newContent: string,
    instructions?: string,
  ): Promise<string | undefined> {
    let fileReadResult = this.fileHandler.getFileReadResult(relativePath);
    const uri = new URI(path.join(this.appConfig.workspaceDir, relativePath));
    const modelReference = await this.modelService.createModelReference(uri);
    const fileContent = modelReference.instance.getMonacoModel().getValue();
    if (!fileReadResult) {
      fileReadResult = {
        content: fileContent,
        startLineOneIndexed: 1,
        endLineOneIndexedInclusive: fileContent.split('\n').length,
      };
    }
    const apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiApiKey, '');
    const baseURL = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiBaseURL, '');
    const stream = await this.aiBackService.requestStream(
      `Merge all changes from the <update> snippet into the <code> below.
    - Preserve the code's structure, order, comments, and indentation exactly.
    - Output only the updated code, enclosed within <updated-code> and </updated-code> tags.
    - Do not include any additional text, explanations, placeholders, ellipses, or code fences.
    
    <code>${fileReadResult.content}</code>
    
    <update>${newContent}</update>
    
    Provide the complete updated code.
    <updated-code>`,
      {
        model: 'openai',
        modelId: 'qwen-turbo',
        baseURL,
        apiKey,
        clientId: this.applicationService.clientId,
        history: [
          {
            id: 'system',
            order: 0,
            role: ChatMessageRole.System,
            content:
              'You are a coding assistant that helps merge code updates, ensuring every modification is fully integrated.',
          },
        ],
        // TODO: 特殊参数如何透传
        providerOptions: {
          openai: {
            extend_fields: {
              sp_edit: 1,
              sp_advice_prompt: `<updated-code>${fileReadResult.content}</updated-code>`,
            },
          },
        },
      },
    );

    const chatResponse = new ChatResponseModel(
      uuid(),
      this.chatInternalService.sessionModel,
      ChatProxyService.AGENT_ID,
    );
    listenReadable<IChatProgress>(stream, {
      onData: (data) => {
        chatResponse.updateContent(data, true);
      },
      onEnd: () => {
        chatResponse.complete();
      },
      onError: (error) => {
        chatResponse.setErrorDetails({
          message: error.message,
        });
        chatResponse.cancel();
      },
    });
    const openResult = await this.editorService.open(URI.file(this.appConfig.workspaceDir + '/' + relativePath));
    if (!openResult) {
      throw new Error('Failed to open editor');
    }

    return await new Promise<string | undefined>((resolve, reject) => {
      chatResponse.onDidChange(async () => {
        if (chatResponse.isComplete) {
          if (chatResponse.errorDetails) {
            reject(new Error(chatResponse.errorDetails.message));
          }
          // Set the new content
          const newContent = chatResponse.responseText.match(/<updated-code>([\s\S]*?)<\/updated-code>/)?.[1] || '';
          if (!newContent) {
            reject(new Error('No updated code found'));
          }
          const applyResult = await this.renderApplyResult(
            relativePath,
            newContent,
            new Range(fileReadResult.startLineOneIndexed, 0, fileReadResult.endLineOneIndexedInclusive, 0),
          );
          resolve(applyResult);
        } else if (chatResponse.isCanceled) {
          reject(new Error('Apply cancelled: ' + chatResponse.errorDetails?.message));
        }
      });
    });
    // TODO: 诊断信息+迭代
  }
}
