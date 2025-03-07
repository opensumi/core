import { Autowired, Injectable } from '@opensumi/di';
import { AIBackSerivcePath, IAIBackService, IChatProgress, URI, path } from '@opensumi/ide-core-browser';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
import { Range } from '@opensumi/monaco-editor-core';

import { ChatProxyServiceToken } from '../../common';
import { CodeBlockData } from '../../common/types';
import { BaseApplyService } from '../mcp/base-apply.service';

import { ChatProxyService } from './chat-proxy.service';

@Injectable()
export class ApplyService extends BaseApplyService {
  @Autowired(IEditorDocumentModelService)
  private readonly modelService: IEditorDocumentModelService;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;
  @Autowired(ChatProxyServiceToken)
  private readonly chatProxyService: ChatProxyService;

  protected async doApply(codeBlock: CodeBlockData): Promise<{
    range?: Range;
    stream?: SumiReadableStream<IChatProgress, Error>;
    result?: string;
  }> {
    const uri = new URI(path.join(this.appConfig.workspaceDir, codeBlock.relativePath));
    const modelReference = await this.modelService.createModelReference(uri);
    const fileContent = modelReference.instance.getMonacoModel().getValue();
    const stream = await this.aiBackService.requestStream(
      `Merge all changes from the <update> snippet into the <code> below.
    - Preserve the code's structure, order, comments, and indentation exactly.
    - Output only the updated code, enclosed within <updated-code> and </updated-code> tags.
    - Do not include any additional text, explanations, placeholders, ellipses, or code fences.
    
    <code>${fileContent}</code>
    
    <update>${codeBlock.codeEdit}</update>
    
    Provide the complete updated code.
`,
      {
        ...this.chatProxyService.getRequestOptions(),
        trimTexts: ['<updated-code>', '</updated-code>'],
        system:
          'You are a coding assistant that helps merge code updates, ensuring every modification is fully integrated.',
      },
    );

    return {
      stream,
    };
  }
}
