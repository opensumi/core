import { createPatch } from 'diff';

import { Autowired, Injectable } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AppConfig,
  ChatMessageRole,
  IAIBackService,
  IApplicationService,
  URI,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { Range } from '@opensumi/monaco-editor-core';
import { Selection, SelectionDirection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/selection';

import { IChatInternalService } from '../../common';
import { ChatInternalService } from '../chat/chat.internal.service';
import { InlineChatController } from '../widget/inline-chat/inline-chat-controller';
import { BaseInlineDiffPreviewer, InlineDiffController, InlineDiffService } from '../widget/inline-diff';

import { FileHandler } from './tools/handlers/ReadFile';

// 提供代码块的唯一索引，迭代轮次，生成状态管理（包括取消），关联文件位置这些信息的记录，后续并行 apply 的支持
@Injectable()
export class ApplyService {
  @Autowired(FileHandler)
  fileHandler: FileHandler;

  @Autowired(IChatInternalService)
  chatInternalService: ChatInternalService;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IEditorDocumentModelService)
  private readonly modelService: IEditorDocumentModelService;

  @Autowired(InlineDiffService)
  private readonly inlineDiffService: InlineDiffService;

  @Autowired(IApplicationService)
  private readonly applicationService: IApplicationService;

  private codeBlockMap = new Map<string, CodeBlockData>();

  private activePreviewer: BaseInlineDiffPreviewer<any> | undefined;

  getCodeBlock(blockId: string): CodeBlockData | undefined {
    return this.codeBlockMap.get(blockId);
  }

  /**
   * Register a new code block and return its unique ID
   */
  registerCodeBlock(relativePath: string, content: string): string {
    const blockId = this.generateBlockId(relativePath);

    if (!this.codeBlockMap.has(blockId)) {
      this.codeBlockMap.set(blockId, {
        id: blockId,
        content,
        status: 'generating',
        iterationCount: 0,
        createdAt: Date.now(),
      });
    }

    return blockId;
  }

  /**
   * Apply changes of a code block
   */
  async apply(relativePath: string, newContent: string, instructions?: string): Promise<CodeBlockData> {
    const blockId = this.generateBlockId(relativePath);
    const blockData = this.getCodeBlock(blockId);
    if (!blockData) {
      throw new Error('Code block not found');
    }
    try {
      blockData.iterationCount++;
      blockData.content = newContent;
      const applyDiffResult = await this.doApply(relativePath, newContent, instructions);
      blockData.applyResult = applyDiffResult;
      return blockData;
    } catch (err) {
      blockData.status = 'failed';
      throw err;
    }
  }

  /**
   * Cancel an ongoing apply operation
   */
  cancelApply(relativePath: string): void {
    const blockId = this.generateBlockId(relativePath);
    const blockData = this.getCodeBlock(blockId);
    if (blockData && blockData.status === 'generating') {
      if (this.activePreviewer) {
        this.activePreviewer.dispose();
      }
      blockData.status = 'cancelled';
    }
  }

  protected async doApply(relativePath: string, newContent: string, instructions?: string): Promise<string> {
    let fileReadResult = this.fileHandler.getFileReadResult(relativePath);
    const uri = new URI(`${this.appConfig.workspaceDir}/${relativePath}`);
    const modelReference = await this.modelService.createModelReference(uri);
    const fileContent = modelReference.instance.getMonacoModel().getValue();
    if (!fileReadResult) {
      fileReadResult = {
        content: fileContent,
        startLineOneIndexed: 1,
        endLineOneIndexedInclusive: fileContent.split('\n').length,
      };
    }
    const stream = await this.aiBackService.requestStream(
      `Merge all changes from the <update> snippet into the <code> below.
- Preserve the code's structure, order, comments, and indentation exactly.
- Output only the updated code, enclosed within <updated-code> and </updated-code> tags.
- Do not include any additional text, explanations, placeholders, ellipses, or code fences.
${instructions ? `- ${instructions}\n` : ''}
<code>${fileReadResult.content}</code>

<update>${newContent}</update>

Provide the complete updated code.
<updated-code>`,
      {
        model: 'openai',
        modelId: 'fast-apply-7b',
        baseURL: 'https://whale-wave.alibaba-inc.com/api/v2/services/aigc/text-generation/v1/chat/completions',
        apiKey: '6RMIBMVXJC',
        clientId: this.applicationService.clientId,
        temperature: 0,
        // TODO: 特殊参数如何透传
        providerOptions: {
          extend_fields: {
            sp_edit: 1,
            sp_advice_prompt: `<updated-code>${fileReadResult.content}</updated-code>`,
          },
        },
      },
    );
    const openResult = await this.editorService.open(URI.file(this.appConfig.workspaceDir + '/' + relativePath));
    if (!openResult) {
      throw new Error('Failed to open editor');
    }
    const editor = openResult.group.codeEditor.monacoEditor;
    const inlineDiffHandler = InlineDiffController.get(editor)!;
    const controller = new InlineChatController();
    controller.mountReadable(stream);
    const blockId = this.generateBlockId(relativePath);
    const blockData = this.getCodeBlock(blockId)!;
    stream.on('end', () => {
      blockData.status = 'pending';
    });

    return new Promise<string>((resolve, reject) => {
      this.activePreviewer = inlineDiffHandler.showPreviewerByStream(editor, {
        crossSelection: Selection.fromRange(
          new Range(fileReadResult.startLineOneIndexed, 0, fileReadResult.endLineOneIndexedInclusive, 0),
          SelectionDirection.LTR,
        ),
        // TODO: trim 掉首尾的 updated-code
        chatResponse: controller,
        previewerOptions: {
          disposeWhenEditorClosed: false,
        },
      });
      this.inlineDiffService.onPartialEdit((event) => {
        // TODO 支持自动保存
        if (event.totalPartialEditCount === event.resolvedPartialEditCount) {
          blockData.status = 'success';
          const appliedResult = editor.getModel()!.getValue();
          //   TODO: 可以移除header
          resolve(createPatch(relativePath, fileContent, appliedResult));
        }
      });
    });
    // TODO: 应用失败？
    // TODO: 诊断信息+迭代
  }

  private generateBlockId(relativePath: string): string {
    const sessionId = this.chatInternalService.sessionModel.sessionId;
    const lastUserMessageId = this.chatInternalService.sessionModel.history
      .getMessages()
      .findLast((msg) => msg.role === ChatMessageRole.User)?.id;
    return `${sessionId}:${relativePath}:${lastUserMessageId || '-'}`;
  }
}

export interface CodeBlockData {
  id: string;
  content: string;
  status: CodeBlockStatus;
  iterationCount: number;
  createdAt: number;
  applyResult?: string;
}

export type CodeBlockStatus = 'generating' | 'pending' | 'success' | 'rejected' | 'failed' | 'cancelled';
