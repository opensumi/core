import { createPatch } from 'diff';

import { Autowired } from '@opensumi/di';
import { AppConfig, ChatMessageRole, OnEvent, WithEventBus } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorGroupCloseEvent } from '@opensumi/ide-editor/lib/browser';
import { Range, Selection, SelectionDirection } from '@opensumi/ide-monaco';
import { observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';
import { Deferred, URI, path } from '@opensumi/ide-utils';

import { IChatInternalService } from '../../common';
import { ChatInternalService } from '../chat/chat.internal.service';
import {
  BaseInlineDiffPreviewer,
  InlineDiffController,
  InlineDiffService,
  LiveInlineDiffPreviewer,
} from '../widget/inline-diff';
import { InlineStreamDiffHandler } from '../widget/inline-stream-diff/inline-stream-diff.handler';

import { FileHandler } from './tools/handlers/ReadFile';

// 提供代码块的唯一索引，迭代轮次，生成状态管理（包括取消），关联文件位置这些信息的记录，后续并行 apply 的支持
export abstract class BaseApplyService extends WithEventBus {
  @Autowired(FileHandler)
  protected fileHandler: FileHandler;

  @Autowired(IChatInternalService)
  protected chatInternalService: ChatInternalService;

  @Autowired(AppConfig)
  protected appConfig: AppConfig;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired(InlineDiffService)
  private readonly inlineDiffService: InlineDiffService;

  constructor() {
    super();
    this.chatInternalService.onCancelRequest(() => {
      this.cancelAllApply();
    });
    this.chatInternalService.onRegenerateRequest(() => {
      const lastUserMessageId = this.chatInternalService.sessionModel.history
        .getMessages()
        .findLast((msg) => msg.role === ChatMessageRole.User)?.id;
      lastUserMessageId && this.disposeApplyForMessage(lastUserMessageId);
    });
  }

  public readonly codeBlockMapObservable = observableValue<Map<string, CodeBlockData>>(this, new Map());

  private activePreviewer: BaseInlineDiffPreviewer<InlineStreamDiffHandler> | undefined;

  private pendingApplyParams:
    | {
        relativePath: string;
        newContent: string;
        range?: Range;
      }
    | undefined;

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupClose(event: EditorGroupCloseEvent) {
    if (this.activePreviewer?.getNode()?.uri.path.toString() === event.payload.resource.uri.path.toString()) {
      this.activePreviewer.dispose();
      this.activePreviewer = undefined;
    }
  }

  getCodeBlock(relativeOrAbsolutePath: string): CodeBlockData | undefined {
    if (!relativeOrAbsolutePath) {
      return undefined;
    }
    const blockId = this.generateBlockId(relativeOrAbsolutePath);
    return this.codeBlockMapObservable.get().get(blockId);
  }

  protected updateCodeBlock(codeBlock: CodeBlockData) {
    const codeBlockMap = new Map(this.codeBlockMapObservable.get());
    codeBlockMap.set(codeBlock.id, codeBlock);
    transaction((tx) => {
      this.codeBlockMapObservable.set(codeBlockMap, tx);
    });
  }

  /**
   * Register a new code block and return its unique ID
   */
  registerCodeBlock(relativePath: string, content: string): string {
    const blockId = this.generateBlockId(relativePath);

    if (!this.codeBlockMapObservable.get().has(blockId)) {
      this.codeBlockMapObservable.get().set(blockId, {
        id: blockId,
        content,
        relativePath,
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
    const blockData = this.getCodeBlock(relativePath);
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
      this.updateCodeBlock(blockData);
      throw err;
    }
  }

  async reRenderPendingApply() {
    if (!this.pendingApplyParams) {
      throw new Error('No pending apply params');
    }
    await this.renderApplyResult(
      this.pendingApplyParams.relativePath,
      this.pendingApplyParams.newContent,
      this.pendingApplyParams.range,
    );
  }

  async renderApplyResult(relativePath: string, newContent: string, range?: Range): Promise<string | undefined> {
    // 用户可能会关闭编辑器，所以需要缓存参数
    this.pendingApplyParams = {
      relativePath,
      newContent,
      range,
    };
    const blockData = this.getCodeBlock(relativePath);
    if (!blockData) {
      throw new Error('Code block not found');
    }
    const openResult = await this.editorService.open(URI.file(path.join(this.appConfig.workspaceDir, relativePath)));
    if (!openResult) {
      throw new Error('Failed to open editor');
    }
    const editor = openResult.group.codeEditor.monacoEditor;
    const inlineDiffController = InlineDiffController.get(editor)!;
    blockData.status = 'pending';
    this.updateCodeBlock(blockData);

    range = range || editor.getModel()?.getFullModelRange()!;
    // Create diff previewer
    const previewer = inlineDiffController.createDiffPreviewer(
      editor,
      Selection.fromRange(range, SelectionDirection.LTR),
      {
        disposeWhenEditorClosed: true,
        renderRemovedWidgetImmediately: true,
      },
    ) as LiveInlineDiffPreviewer;
    this.activePreviewer = previewer;

    const fullOriginalContent = editor.getModel()!.getValue();
    const savedContent = editor.getModel()!.getValueInRange(range);
    const deferred = new Deferred<string>();
    if (newContent === savedContent) {
      blockData.status = 'success';
      this.updateCodeBlock(blockData);
      deferred.resolve();
    } else {
      previewer.setValue(newContent);
      this.inlineDiffService.onPartialEdit((event) => {
        // TODO 支持自动保存
        if (event.totalPartialEditCount === event.resolvedPartialEditCount) {
          if (previewer.getNode()?.livePreviewDiffDecorationModel.hasAcceptedChanges()) {
            blockData.status = 'success';
            this.updateCodeBlock(blockData);
            const appliedResult = editor.getModel()!.getValue();
            // TODO: 可以移除header
            deferred.resolve(createPatch(relativePath, fullOriginalContent, appliedResult));
          } else {
            // 用户全部取消
            blockData.status = 'cancelled';
            this.updateCodeBlock(blockData);
            deferred.resolve(undefined);
          }
        }
      });
    }
    return deferred.promise;
  }

  /**
   * Cancel an ongoing apply operation
   */
  cancelApply(relativePath: string): void {
    const blockData = this.getCodeBlock(relativePath);
    if (blockData && (blockData.status === 'generating' || blockData.status === 'pending')) {
      if (this.activePreviewer) {
        this.activePreviewer.getNode()?.livePreviewDiffDecorationModel.discardUnProcessed();
        this.activePreviewer.dispose();
      }
      blockData.status = 'cancelled';
      this.updateCodeBlock(blockData);
    }
  }

  cancelAllApply(): void {
    this.codeBlockMapObservable.get().forEach((blockData) => {
      if (blockData.status === 'generating' || blockData.status === 'pending') {
        this.cancelApply(blockData.relativePath);
      }
    });
  }

  disposeApplyForMessage(messageId: string): void {
    this.codeBlockMapObservable.get().forEach((blockData) => {
      if (blockData.id.endsWith(':' + messageId)) {
        if (blockData.status === 'generating') {
          this.cancelApply(blockData.relativePath);
        }
        // TODO: 副作用清理
        this.codeBlockMapObservable.get().delete(blockData.id);
      }
    });
  }

  revealApplyPosition(blockId: string): void {
    const blockData = this.codeBlockMapObservable.get().get(blockId);
    if (blockData) {
      const hunkInfo = blockData.applyResult?.split('\n').find((line) => line.startsWith('@@'));
      let startLine = 0;
      let endLine = 0;
      if (hunkInfo) {
        // 取改动后的区间
        const [, , , start, end] = hunkInfo.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/)!;
        startLine = parseInt(start, 10) - 1;
        endLine = parseInt(end, 10) - 1;
      }
      this.editorService.open(URI.file(path.join(this.appConfig.workspaceDir, blockData.relativePath)));
      const editor = this.editorService.currentEditor;
      if (editor) {
        editor.setSelection(new Selection(startLine, 0, endLine, 0));
      }
    }
  }

  protected abstract doApply(
    relativePath: string,
    newContent: string,
    instructions?: string,
  ): Promise<string | undefined>;

  protected generateBlockId(absoluteOrRelativePath: string): string {
    if (!absoluteOrRelativePath.startsWith('/')) {
      absoluteOrRelativePath = path.join(this.appConfig.workspaceDir, absoluteOrRelativePath);
    }
    const sessionId = this.chatInternalService.sessionModel.sessionId;
    const lastUserMessageId = this.chatInternalService.sessionModel.history
      .getMessages()
      .findLast((msg) => msg.role === ChatMessageRole.User)?.id;
    return `${sessionId}:${absoluteOrRelativePath}:${lastUserMessageId || '-'}`;
  }
}

export interface CodeBlockData {
  id: string;
  content: string;
  relativePath: string;
  status: CodeBlockStatus;
  iterationCount: number;
  createdAt: number;
  applyResult?: string;
}

export type CodeBlockStatus = 'generating' | 'pending' | 'success' | 'rejected' | 'failed' | 'cancelled';
