import { Autowired, Injectable } from '@opensumi/di';
import {
  AIBackSerivcePath,
  CancellationTokenSource,
  IAIBackService,
  IChatProgress,
  URI,
  path,
} from '@opensumi/ide-core-browser';
import { CommandService } from '@opensumi/ide-core-common/lib/command';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { CodeAction, CodeActionContext, CodeActionTriggerType, ICodeEditor } from '@opensumi/ide-monaco';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
import { Range } from '@opensumi/monaco-editor-core';

import { ChatProxyServiceToken } from '../../common';
import { CodeBlockData } from '../../common/types';
import { BaseApplyService } from '../mcp/base-apply.service';

import { ChatProxyService } from './chat-proxy.service';

/**
 * Filter code actions to only apply batch fixes
 * Skip individual fixes as consecutive WorkspaceEdits may interfere with each other
 * @param codeAction The code action to check
 * @returns boolean indicating if the action is auto-fixable
 */
function isAutoFixable(codeAction: CodeAction): boolean {
  return codeAction.title.toLowerCase().includes('all');
}

@Injectable()
export class ApplyService extends BaseApplyService {
  @Autowired(CommandService)
  private commandService: CommandService;

  protected async postApplyHandler(editor: ICodeEditor): Promise<void> {
    const model = editor.getModel();
    if (!model) {
      return Promise.resolve();
    }
    const providers = languageFeaturesService.codeActionProvider.ordered(model);

    if (!providers) {
      return Promise.resolve();
    }

    const [provider] = providers;
    const range = model.getFullModelRange();
    const context: CodeActionContext = {
      trigger: CodeActionTriggerType.Auto,
    };
    const ts = new CancellationTokenSource();
    const actionList = await provider.provideCodeActions(model, range, context, ts.token);

    // 提取所有可修复的代码操作
    const fixableActions = actionList?.actions.filter(isAutoFixable) || [];

    if (fixableActions.length === 0) {
      return Promise.resolve();
    }

    // 执行所有可修复的代码操作
    await Promise.allSettled(
      fixableActions.map(async (action) => {
        if (action.command) {
          try {
            await this.commandService.executeCommand(action.command.id, ...(action.command.arguments || []));
          } catch (err) {}
        }
      }),
    );
  }

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
    ${codeBlock.instructions ? `\nUser's intention: ${codeBlock.instructions}\n` : ''}
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
