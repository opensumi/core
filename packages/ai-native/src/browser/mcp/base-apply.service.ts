import { createPatch } from 'diff';

import { Autowired } from '@opensumi/di';
import { AppConfig, ChatMessageRole, IMarker, MarkerSeverity, OnEvent, WithEventBus } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorGroupCloseEvent } from '@opensumi/ide-editor/lib/browser';
import { IMarkerService } from '@opensumi/ide-markers';
import { Position, Range, Selection, SelectionDirection } from '@opensumi/ide-monaco';
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

  @Autowired(IMarkerService)
  private readonly markerService: IMarkerService;

  constructor() {
    super();
    this.addDispose(
      this.chatInternalService.onCancelRequest(() => {
        this.cancelAllApply();
      }),
    );
    this.addDispose(
      this.chatInternalService.onRegenerateRequest(() => {
        const messages = this.chatInternalService.sessionModel.history.getMessages();
        const messageId = messages[messages.length - 1].id;
        messageId && this.disposeApplyForMessage(messageId);
      }),
    );
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

  /**
   * Get the code block data by relative or absolute path of the last assistant message
   */
  getCodeBlock(relativeOrAbsolutePath: string, messageId?: string): CodeBlockData | undefined {
    if (!relativeOrAbsolutePath) {
      return undefined;
    }
    const blockId = this.generateBlockId(relativeOrAbsolutePath, messageId);
    return this.codeBlockMapObservable.get().get(blockId);
  }

  getCodeBlockById(id: string): CodeBlockData | undefined {
    return this.codeBlockMapObservable.get().get(id);
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

  initToolCallId(blockId: string, toolCallId: string): void {
    const blockData = this.getCodeBlockById(blockId);
    if (blockData && !blockData.initToolCallId) {
      blockData.initToolCallId = toolCallId;
    }
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
      if (++blockData.iterationCount > 3) {
        throw new Error('Max iteration count exceeded');
      }
      blockData.status = 'generating';
      blockData.content = newContent;
      this.updateCodeBlock(blockData);
      const applyDiffResult = await this.doApply(relativePath, newContent, instructions);
      blockData.applyResult = applyDiffResult;
      this.updateCodeBlock(blockData);
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
    const result = await this.renderApplyResult(
      this.pendingApplyParams.relativePath,
      this.pendingApplyParams.newContent,
      this.pendingApplyParams.range,
    );
    if (result) {
      const blockData = this.getCodeBlock(this.pendingApplyParams.relativePath)!;
      blockData.applyResult = result;
      this.updateCodeBlock(blockData);
    }
  }

  async renderApplyResult(
    relativePath: string,
    newContent: string,
    range?: Range,
  ): Promise<{ diff: string; diagnosticInfos: IMarker[] } | undefined> {
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
    const deferred = new Deferred<{ diff: string; diagnosticInfos: IMarker[] }>();
    if (newContent === savedContent) {
      blockData.status = 'success';
      deferred.resolve();
    } else {
      previewer.setValue(newContent);
      this.addDispose(
        this.inlineDiffService.onPartialEdit((event) => {
          // TODO 支持自动保存
          if (event.totalPartialEditCount === event.resolvedPartialEditCount) {
            if (event.acceptPartialEditCount > 0) {
              blockData.status = 'success';
              const appliedResult = editor.getModel()!.getValue();
              const diffResult = createPatch(relativePath, fullOriginalContent, appliedResult)
                .split('\n')
                .slice(4)
                .join('\n');
              const rangesFromDiffHunk = diffResult
                .split('\n')
                .map((line) => {
                  if (line.startsWith('@@')) {
                    const [, , , start, end] = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/)!;
                    return new Range(parseInt(start, 10), 0, parseInt(end, 10), 0);
                  }
                  return null;
                })
                .filter((range) => range !== null);
              const diagnosticInfos = this.getdiagnosticInfos(editor.getModel()!.uri.toString(), rangesFromDiffHunk);
              // 移除开头的几个固定信息，避免浪费 tokens
              deferred.resolve({
                diff: diffResult,
                diagnosticInfos,
              });
            } else {
              // 用户全部取消
              blockData.status = 'cancelled';
              deferred.resolve();
            }
          }
        }),
      );
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
        this.codeBlockMapObservable.get().delete(blockData.id);
      }
    });
  }

  revealApplyPosition(blockId: string): void {
    const blockData = this.codeBlockMapObservable.get().get(blockId);
    if (blockData) {
      const hunkInfo = blockData.applyResult?.diff.split('\n').find((line) => line.startsWith('@@'));
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
  ): Promise<{ diff: string; diagnosticInfos: IMarker[] } | undefined>;

  protected generateBlockId(absoluteOrRelativePath: string, messageId?: string): string {
    if (!absoluteOrRelativePath.startsWith('/')) {
      absoluteOrRelativePath = path.join(this.appConfig.workspaceDir, absoluteOrRelativePath);
    }
    const sessionId = this.chatInternalService.sessionModel.sessionId;
    const messages = this.chatInternalService.sessionModel.history.getMessages();
    messageId = messageId || messages[messages.length - 1].id;
    return `${sessionId}:${absoluteOrRelativePath}:${messageId || '-'}`;
  }

  protected getdiagnosticInfos(uri: string, ranges: Range[]) {
    const markers = this.markerService.getManager().getMarkers({ resource: uri });
    return markers.filter(
      (marker) =>
        marker.severity >= MarkerSeverity.Warning &&
        ranges.some((range) => range.containsPosition(new Position(marker.startLineNumber, marker.startColumn))),
    );
  }
}

export interface CodeBlockData {
  id: string;
  initToolCallId?: string;
  content: string;
  relativePath: string;
  status: CodeBlockStatus;
  iterationCount: number;
  createdAt: number;
  applyResult?: {
    diff: string;
    diagnosticInfos: IMarker[];
  };
}

export type CodeBlockStatus = 'generating' | 'pending' | 'success' | 'rejected' | 'failed' | 'cancelled';
