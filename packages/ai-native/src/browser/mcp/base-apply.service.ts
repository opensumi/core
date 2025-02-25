import { createPatch } from 'diff';

import { Autowired } from '@opensumi/di';
import { AppConfig, IMarker, MarkerSeverity, OnEvent, WithEventBus } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorGroupCloseEvent, EditorGroupOpenEvent } from '@opensumi/ide-editor/lib/browser';
import { IMarkerService } from '@opensumi/ide-markers';
import { Position, Range, Selection, SelectionDirection } from '@opensumi/ide-monaco';
import { Deferred, Emitter, URI, path } from '@opensumi/ide-utils';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { CodeBlockData, CodeBlockStatus } from '../../common/types';
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

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  private onCodeBlockUpdateEmitter = new Emitter<CodeBlockData>();
  public onCodeBlockUpdate = this.onCodeBlockUpdateEmitter.event;

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
        const codeBlockMap = this.getMessageCodeBlocks(messageId);
        if (!codeBlockMap) {
          return;
        }
        Object.values(codeBlockMap).forEach((blockData) => {
          this.cancelApply(blockData);
        });
      }),
    );
  }

  private getMessageCodeBlocks(
    messageId: string,
    sessionId?: string,
  ): { [toolCallId: string]: CodeBlockData } | undefined {
    sessionId = sessionId || this.chatInternalService.sessionModel.sessionId;
    const sessionModel = this.chatInternalService.getSession(sessionId);
    if (!sessionModel) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const message = sessionModel.history.getMessageAdditional(messageId);
    return message?.codeBlockMap;
  }

  private activePreviewer: BaseInlineDiffPreviewer<InlineStreamDiffHandler> | undefined;

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupClose(event: EditorGroupCloseEvent) {
    if (this.activePreviewer?.getNode()?.uri.path.toString() === event.payload.resource.uri.path.toString()) {
      this.activePreviewer.dispose();
      this.activePreviewer = undefined;
    }
  }

  @OnEvent(EditorGroupOpenEvent)
  async onEditorGroupOpen(event: EditorGroupOpenEvent) {
    const relativePath = await this.workspaceService.asRelativePath(event.payload.resource.uri.toString());
    const filePendingApplies = Object.values(
      this.getMessageCodeBlocks(this.chatInternalService.sessionModel.history.lastMessageId) || {},
    ).filter((block) => block.relativePath === relativePath?.path && block.status === 'pending');
    // TODO: 暂时只支持 pending 串行的 apply，后续支持批量apply后统一accept
    if (filePendingApplies.length > 0) {
      this.renderApplyResult(filePendingApplies[0]);
    }
  }

  getCodeBlock(toolCallId: string, messageId?: string): CodeBlockData | undefined {
    messageId = messageId || this.chatInternalService.sessionModel.history.lastMessageId;
    if (!messageId) {
      throw new Error('Message ID is required');
    }
    const codeBlockMap = this.getMessageCodeBlocks(messageId);
    if (!codeBlockMap) {
      return undefined;
    }
    return codeBlockMap[toolCallId];
  }

  protected updateCodeBlock(codeBlock: CodeBlockData, messageId?: string) {
    messageId = messageId || this.chatInternalService.sessionModel.history.lastMessageId;
    if (!messageId) {
      throw new Error('Message ID is required');
    }
    const codeBlockMap = this.getMessageCodeBlocks(messageId);
    if (!codeBlockMap) {
      throw new Error('Code block not found');
    }
    codeBlockMap[codeBlock.toolCallId] = codeBlock;
    this.onCodeBlockUpdateEmitter.fire(codeBlock);
  }

  registerCodeBlock(relativePath: string, content: string, toolCallId: string): CodeBlockData {
    const lastMessageId = this.chatInternalService.sessionModel.history.lastMessageId;
    const savedCodeBlockMap = this.getMessageCodeBlocks(lastMessageId) || {};
    const newBlock: CodeBlockData = {
      codeEdit: content,
      relativePath,
      status: 'generating' as CodeBlockStatus,
      iterationCount: 1,
      version: 1,
      createdAt: Date.now(),
      toolCallId,
    };
    const samePathCodeBlocks = Object.values(savedCodeBlockMap).filter((block) => block.relativePath === relativePath);
    if (samePathCodeBlocks.length > 0) {
      newBlock.version = samePathCodeBlocks.length;
      for (const block of samePathCodeBlocks.sort((a, b) => b.version - a.version)) {
        // 如果连续的上一个同文件apply结果存在LintError，则iterationCount++
        if (block.relativePath === relativePath && block.applyResult?.diagnosticInfos?.length) {
          newBlock.iterationCount++;
        } else {
          break;
        }
      }
    }
    savedCodeBlockMap[toolCallId] = newBlock;
    this.chatInternalService.sessionModel.history.setMessageAdditional(lastMessageId, {
      codeBlockMap: savedCodeBlockMap,
    });
    this.onCodeBlockUpdateEmitter.fire(newBlock);
    return newBlock;
  }

  /**
   * Apply changes of a code block
   */
  async apply(codeBlock: CodeBlockData): Promise<CodeBlockData> {
    try {
      if (codeBlock.iterationCount > 3) {
        throw new Error('Lint error max iteration count exceeded');
      }
      const fastApplyFileResult = await this.doApply(codeBlock);
      if (!fastApplyFileResult) {
        throw new Error('Failed to apply, no changes made');
      }

      // trigger diffPreivewer & return expected diff result directly
      codeBlock.updatedCode = fastApplyFileResult;
      const result = await this.renderApplyResult(codeBlock);
      if (result) {
        // 用户实际接受的 apply 结果
        codeBlock.applyResult = result;
        this.updateCodeBlock(codeBlock);
      }

      return codeBlock;
    } catch (err) {
      codeBlock.status = 'failed';
      this.updateCodeBlock(codeBlock);
      throw err;
    }
  }

  async renderApplyResult(
    codeBlock: CodeBlockData,
    range?: Range,
  ): Promise<{ diff: string; diagnosticInfos: IMarker[] } | undefined> {
    const { relativePath } = codeBlock;
    const openResult = await this.editorService.open(URI.file(path.join(this.appConfig.workspaceDir, relativePath)));
    if (!openResult) {
      throw new Error('Failed to open editor');
    }
    const editor = openResult.group.codeEditor.monacoEditor;
    const inlineDiffController = InlineDiffController.get(editor)!;
    codeBlock.status = 'pending';
    this.updateCodeBlock(codeBlock);

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
    // TODO: 支持多个diffPreviewer
    this.activePreviewer = previewer;

    const fullOriginalContent = editor.getModel()!.getValue();
    const savedContent = editor.getModel()!.getValueInRange(range);
    const deferred = new Deferred<{ diff: string; diagnosticInfos: IMarker[] }>();
    if (codeBlock.updatedCode === savedContent) {
      codeBlock.status = 'success';
      deferred.resolve();
    } else {
      previewer.setValue(codeBlock.updatedCode!);
      this.addDispose(
        this.inlineDiffService.onPartialEdit((event) => {
          // TODO 支持自动保存
          if (event.totalPartialEditCount === event.resolvedPartialEditCount) {
            if (event.acceptPartialEditCount > 0) {
              codeBlock.status = 'success';
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
              const diagnosticInfos = this.getDiagnosticInfos(editor.getModel()!.uri.toString(), rangesFromDiffHunk);
              // 移除开头的几个固定信息，避免浪费 tokens
              deferred.resolve({
                diff: diffResult,
                diagnosticInfos,
              });
            } else {
              // 用户全部取消
              codeBlock.status = 'cancelled';
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
  cancelApply(blockData: CodeBlockData): void {
    if (blockData.status === 'generating' || blockData.status === 'pending') {
      if (this.activePreviewer) {
        this.activePreviewer.getNode()?.livePreviewDiffDecorationModel.discardUnProcessed();
        this.activePreviewer.dispose();
      }
      blockData.status = 'cancelled';
      this.updateCodeBlock(blockData);
    }
  }

  // TODO: 目前的设计下，有一个工具 apply 没返回，是不会触发下一个的(cursor 是会全部自动 apply 的），所以这个方法目前还没有必要
  cancelAllApply(): void {
    const messageId = this.chatInternalService.sessionModel.history.lastMessageId;
    const codeBlockMap = this.getMessageCodeBlocks(messageId);
    if (!codeBlockMap) {
      return;
    }
    Object.values(codeBlockMap).forEach((blockData) => {
      this.cancelApply(blockData);
    });
  }

  revealApplyPosition(blockData: CodeBlockData): void {
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

  protected abstract doApply(codeBlock: CodeBlockData): Promise<string | undefined>;

  // TODO: 支持使用内存中的document获取诊断信息，实现并行apply accept
  protected getDiagnosticInfos(uri: string, ranges: Range[]) {
    const markers = this.markerService.getManager().getMarkers({ resource: uri });
    return markers.filter(
      (marker) =>
        marker.severity >= MarkerSeverity.Warning &&
        ranges.some((range) => range.containsPosition(new Position(marker.startLineNumber, marker.startColumn))),
    );
  }
}
