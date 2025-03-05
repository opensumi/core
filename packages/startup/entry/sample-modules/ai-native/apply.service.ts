import { Autowired, Injectable } from '@opensumi/di';
import { BaseApplyService } from '@opensumi/ide-ai-native/lib/browser/mcp/base-apply.service';
import { CodeBlockData } from '@opensumi/ide-ai-native/lib/common/types';
import {
  AIBackSerivcePath,
  AINativeSettingSectionsId,
  IAIBackService,
  IApplicationService,
  IChatProgress,
  PreferenceService,
  URI,
  path,
} from '@opensumi/ide-core-browser';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
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

  protected async doApply(codeBlock: CodeBlockData): Promise<{
    range?: Range;
    stream?: SumiReadableStream<IChatProgress, Error>;
    result?: string;
  }> {
    const uri = new URI(path.join(this.appConfig.workspaceDir, codeBlock.relativePath));
    const modelReference = await this.modelService.createModelReference(uri);
    const fileContent = modelReference.instance.getMonacoModel().getValue();
    const apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiApiKey, '');
    const baseURL = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiBaseURL, '');
    const stream = await this.aiBackService.requestStream(
      `Merge all changes from the <update> snippet into the <code> below.
    - Preserve the code's structure, order, comments, and indentation exactly.
    - Output only the updated code, enclosed within <updated-code> and </updated-code> tags.
    - Do not include any additional text, explanations, placeholders, ellipses, or code fences.
    
    <code>${fileContent}</code>
    
    <update>${codeBlock.codeEdit}</update>
    
    Provide the complete updated code.
    <updated-code>`,
      {
        model: 'openai-compatible',
        modelId: 'qwen-turbo',
        baseURL,
        apiKey,
        clientId: this.applicationService.clientId,
        trimTexts: ['<updated-code>', '</updated-code>'],
        history: [
          {
            role: 'system',
            content:
              'You are a coding assistant that helps merge code updates, ensuring every modification is fully integrated.',
          },
        ],
      },
    );

    return {
      stream,
    };
  }
}
