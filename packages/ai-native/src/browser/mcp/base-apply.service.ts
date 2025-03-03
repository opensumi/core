import { createPatch } from 'diff';

import { Autowired } from '@opensumi/di';
import { AppConfig, IChatProgress, IMarker, MarkerSeverity, OnEvent, WithEventBus } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorGroupCloseEvent,
  EditorGroupOpenEvent,
  IEditorDocumentModelService,
  RegisterEditorSideComponentEvent,
} from '@opensumi/ide-editor/lib/browser';
import { IMarkerService } from '@opensumi/ide-markers';
import { ICodeEditor, Position, Range, Selection, SelectionDirection } from '@opensumi/ide-monaco';
import { Deferred, DisposableMap, Emitter, IDisposable, URI, path } from '@opensumi/ide-utils';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { IChatInternalService } from '../../common';
import { CodeBlockData, CodeBlockStatus } from '../../common/types';
import { ChatInternalService } from '../chat/chat.internal.service';
import { InlineChatController } from '../widget/inline-chat/inline-chat-controller';
import {
  BaseInlineDiffPreviewer,
  InlineDiffController,
  InlineDiffService,
  LiveInlineDiffPreviewer,
} from '../widget/inline-diff';
import { BaseInlineStreamDiffHandler } from '../widget/inline-stream-diff/inline-stream-diff.handler';

export abstract class BaseApplyService extends WithEventBus {
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

  @Autowired(IEditorDocumentModelService)
  private readonly editorDocumentModelService: IEditorDocumentModelService;

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

  private getSessionCodeBlocksForPath(relativePath: string, sessionId?: string) {
    sessionId = sessionId || this.chatInternalService.sessionModel.sessionId;
    const sessionModel = this.chatInternalService.getSession(sessionId);
    if (!sessionModel) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const sessionAdditionals = sessionModel.history.sessionAdditionals;
    const codeBlocks: CodeBlockData[] = Array.from(sessionAdditionals.values())
      .map((additional) => additional.codeBlockMap as { [toolCallId: string]: CodeBlockData })
      .reduce((acc, cur) => {
        Object.values(cur).forEach((block) => {
          if (block.relativePath === relativePath) {
            acc.push(block);
          }
        });
        return acc;
      }, [] as CodeBlockData[])
      .sort((a, b) => b.version - a.version);
    return codeBlocks;
  }

  private activePreviewerMap = this.registerDispose(
    new DisposableMap<string, BaseInlineDiffPreviewer<BaseInlineStreamDiffHandler>>(),
  );

  private editorListenerMap = this.registerDispose(new DisposableMap<string, IDisposable>());

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupClose(event: EditorGroupCloseEvent) {
    const relativePath = path.relative(this.appConfig.workspaceDir, event.payload.resource.uri.path.toString());
    const activePreviewer = this.activePreviewerMap.get(relativePath);
    if (activePreviewer) {
      this.activePreviewerMap.disposeKey(relativePath);
    }
    this.editorListenerMap.disposeKey(event.payload.resource.uri.toString());
  }

  @OnEvent(EditorGroupOpenEvent)
  async onEditorGroupOpen(event: EditorGroupOpenEvent) {
    const relativePath = path.relative(this.appConfig.workspaceDir, event.payload.resource.uri.path.toString());
    if (
      this.duringApply ||
      this.activePreviewerMap.has(relativePath) ||
      !this.chatInternalService.sessionModel.history.getMessages().length
    ) {
      return;
    }
    const filePendingApplies = Object.values(
      this.getMessageCodeBlocks(this.chatInternalService.sessionModel.history.lastMessageId!) || {},
    ).filter((block) => block.relativePath === relativePath && block.status === 'pending');
    // TODO: 刷新后重新应用，事件无法恢复 & 恢复继续请求，需要改造成批量apply形式
    if (filePendingApplies.length > 0 && filePendingApplies[0].updatedCode) {
      const editor = event.payload.group.codeEditor.monacoEditor;
      this.renderApplyResult(editor, filePendingApplies[0], filePendingApplies[0].updatedCode);
    }
  }

  getUriPendingCodeBlock(uri: URI): CodeBlockData | undefined {
    const messageId = this.chatInternalService.sessionModel.history.lastMessageId;
    if (!messageId) {
      return undefined;
    }
    const codeBlockMap = this.getMessageCodeBlocks(messageId);
    if (!codeBlockMap) {
      return undefined;
    }
    return Object.values(codeBlockMap).find(
      (block) =>
        block.relativePath === path.relative(this.appConfig.workspaceDir, uri.path.toString()) &&
        block.status === 'pending',
    );
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
    this.chatInternalService.sessionModel.history.setMessageAdditional(messageId, {
      codeBlockMap,
    });
    this.onCodeBlockUpdateEmitter.fire(codeBlock);
  }

  async registerCodeBlock(relativePath: string, content: string, toolCallId: string): Promise<CodeBlockData> {
    const lastMessageId = this.chatInternalService.sessionModel.history.lastMessageId!;
    const savedCodeBlockMap = this.getMessageCodeBlocks(lastMessageId) || {};
    const originalCode = await this.editorDocumentModelService.createModelReference(
      URI.file(path.join(this.appConfig.workspaceDir, relativePath)),
    );
    const newBlock: CodeBlockData = {
      codeEdit: content,
      relativePath,
      status: 'generating' as CodeBlockStatus,
      iterationCount: 1,
      version: 1,
      createdAt: Date.now(),
      toolCallId,
      // TODO: 支持range
      originalCode: originalCode.instance.getText(),
    };
    const samePathCodeBlocks = Object.values(savedCodeBlockMap).filter((block) => block.relativePath === relativePath);
    if (samePathCodeBlocks.length > 0) {
      newBlock.version = samePathCodeBlocks.length;
      for (const block of samePathCodeBlocks.sort((a, b) => a.version - b.version)) {
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

  private duringApply?: boolean;

  /**
   * Apply changes of a code block
   */
  async apply(codeBlock: CodeBlockData): Promise<CodeBlockData> {
    try {
      this.duringApply = true;
      if (codeBlock.iterationCount > 3) {
        throw new Error('Lint error max iteration count exceeded');
      }
      const fastApplyFileResult = await this.doApply(codeBlock);
      if (!fastApplyFileResult.stream && !fastApplyFileResult.result) {
        throw new Error('No apply content provided');
      }

      if (this.activePreviewerMap.has(codeBlock.relativePath)) {
        this.activePreviewerMap.disposeKey(codeBlock.relativePath);
      }
      // FIXME: 同一个bubble单个文件多次写入（如迭代）兼容
      // trigger diffPreivewer & return expected diff result directly
      const result = await this.editorService.open(
        URI.file(path.join(this.appConfig.workspaceDir, codeBlock.relativePath)),
      );
      if (!result) {
        throw new Error('Failed to open file');
      }
      const applyResult = await this.renderApplyResult(
        result.group.codeEditor.monacoEditor,
        codeBlock,
        (fastApplyFileResult.result || fastApplyFileResult.stream)!,
        fastApplyFileResult.range,
      );
      if (applyResult) {
        // 用户实际接受的 apply 结果
        codeBlock.applyResult = applyResult;
        this.updateCodeBlock(codeBlock);
      }

      return codeBlock;
    } catch (err) {
      codeBlock.status = 'failed';
      this.updateCodeBlock(codeBlock);
      throw err;
    } finally {
      this.duringApply = false;
    }
  }

  async renderApplyResult(
    editor: ICodeEditor,
    codeBlock: CodeBlockData,
    updatedContentOrStream: string | SumiReadableStream<IChatProgress>,
    range?: Range,
  ): Promise<{ diff: string; diagnosticInfos: IMarker[] } | undefined> {
    const deferred = new Deferred<{ diff: string; diagnosticInfos: IMarker[] }>();
    const inlineDiffController = InlineDiffController.get(editor)!;

    if (typeof updatedContentOrStream === 'string') {
      const editorCurrentContent = editor.getModel()!.getValue();
      const document = this.editorDocumentModelService.getModelReference(
        URI.file(path.join(this.appConfig.workspaceDir, codeBlock.relativePath)),
      );
      if (editorCurrentContent !== updatedContentOrStream || document?.instance.dirty) {
        editor.getModel()!.setValue(updatedContentOrStream);
        await this.editorService.save(URI.file(path.join(this.appConfig.workspaceDir, codeBlock.relativePath)));
      }
      const earlistPendingCodeBlock = this.getSessionCodeBlocksForPath(codeBlock.relativePath).find(
        (block) => block.status === 'pending',
      );
      if ((earlistPendingCodeBlock?.originalCode || codeBlock.originalCode) === updatedContentOrStream) {
        codeBlock.status = 'cancelled';
        this.updateCodeBlock(codeBlock);
        deferred.resolve();
        return;
      }
      // Create diff previewer
      const previewer = inlineDiffController.createDiffPreviewer(
        editor,
        Selection.fromRange((range = range || editor.getModel()!.getFullModelRange()), SelectionDirection.LTR),
        {
          disposeWhenEditorClosed: true,
          renderRemovedWidgetImmediately: true,
          reverse: true,
        },
      ) as LiveInlineDiffPreviewer;
      this.activePreviewerMap.set(codeBlock.relativePath, previewer);
      codeBlock.updatedCode = updatedContentOrStream;
      codeBlock.status = 'pending';
      this.updateCodeBlock(codeBlock);
      previewer.setValue(earlistPendingCodeBlock?.originalCode || codeBlock.originalCode);
      // 强刷展示 manager 视图
      this.eventBus.fire(new RegisterEditorSideComponentEvent());

      this.listenPartialEdit(editor, codeBlock).then((result) => {
        if (result) {
          codeBlock.applyResult = result;
        }
        this.updateCodeBlock(codeBlock);
        this.editorService.save(URI.file(path.join(this.appConfig.workspaceDir, codeBlock.relativePath)));
      });

      const { diff, rangesFromDiffHunk } = this.getDiffResult(
        codeBlock.originalCode,
        codeBlock.updatedCode,
        codeBlock.relativePath,
      );
      const diagnosticInfos = this.getDiagnosticInfos(editor.getModel()!.uri.toString(), rangesFromDiffHunk);
      deferred.resolve({
        diff,
        diagnosticInfos,
      });
    } else {
      const controller = new InlineChatController();
      controller.mountReadable(updatedContentOrStream);
      const inlineDiffHandler = InlineDiffController.get(editor)!;

      const previewer = inlineDiffHandler.showPreviewerByStream(editor, {
        crossSelection: Selection.fromRange(range || editor.getModel()!.getFullModelRange(), SelectionDirection.LTR),
        chatResponse: controller,
        previewerOptions: {
          disposeWhenEditorClosed: true,
          renderRemovedWidgetImmediately: false,
        },
      }) as LiveInlineDiffPreviewer;
      this.addDispose(
        // 流式输出结束后，转为直接输出逻辑
        previewer.getNode()!.onDiffFinished(async (diffModel) => {
          codeBlock.updatedCode = diffModel.newFullRangeTextLines.join('\n');
          // TODO: 添加 reapply
          // 实际应用结果为空，则取消
          if (codeBlock.updatedCode === codeBlock.originalCode) {
            codeBlock.status = 'cancelled';
            this.updateCodeBlock(codeBlock);
            previewer.dispose();
            deferred.resolve();
            return;
          }
          this.updateCodeBlock(codeBlock);
          previewer.dispose();
          const result = await this.renderApplyResult(editor, codeBlock, codeBlock.updatedCode);
          deferred.resolve(result);
        }),
      );
      this.activePreviewerMap.set(codeBlock.relativePath, previewer);
    }
    return deferred.promise;
  }

  /**
   * Cancel an ongoing apply operation
   */
  cancelApply(blockData: CodeBlockData): void {
    if (blockData.status === 'generating' || blockData.status === 'pending') {
      if (this.activePreviewerMap.has(blockData.relativePath)) {
        this.activePreviewerMap
          .get(blockData.relativePath)
          ?.getNode()
          ?.livePreviewDiffDecorationModel.discardUnProcessed();
        this.activePreviewerMap.disposeKey(blockData.relativePath);
      }
      blockData.status = 'cancelled';
      this.updateCodeBlock(blockData);
    }
  }

  // TODO: 目前的设计下，有一个工具 apply 没返回，是不会触发下一个的(cursor 是会全部自动 apply 的），所以这个方法目前还没有必要
  cancelAllApply(): void {
    const messageId = this.chatInternalService.sessionModel.history.lastMessageId!;
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

  processAll(uri: URI, type: 'accept' | 'reject'): void {
    const codeBlock = this.getUriPendingCodeBlock(uri);
    if (!codeBlock) {
      throw new Error('No pending code block found');
    }
    const decorationModel = this.activePreviewerMap
      .get(codeBlock.relativePath)
      ?.getNode()?.livePreviewDiffDecorationModel;
    if (!decorationModel) {
      throw new Error('No active previewer found');
    }
    if (type === 'accept') {
      decorationModel.acceptUnProcessed();
    } else {
      decorationModel.discardUnProcessed();
    }
    this.editorService.save(uri);
    codeBlock.status = type === 'accept' ? 'success' : 'cancelled';
    this.updateCodeBlock(codeBlock);
  }

  protected listenPartialEdit(editor: ICodeEditor, codeBlock: CodeBlockData) {
    const deferred = new Deferred<{ diff: string; diagnosticInfos: IMarker[] }>();
    const uriString = editor.getModel()!.uri.toString();
    const toDispose = this.inlineDiffService.onPartialEdit((event) => {
      // TODO 支持自动保存
      if (
        event.totalPartialEditCount === event.resolvedPartialEditCount &&
        event.uri.path === editor.getModel()!.uri.path.toString()
      ) {
        if (event.acceptPartialEditCount > 0) {
          codeBlock.status = 'success';
          const appliedResult = editor.getModel()!.getValue();
          const { diff, rangesFromDiffHunk } = this.getDiffResult(
            codeBlock.originalCode,
            appliedResult,
            codeBlock.relativePath,
          );
          const diagnosticInfos = this.getDiagnosticInfos(editor.getModel()!.uri.toString(), rangesFromDiffHunk);
          // 移除开头的几个固定信息，避免浪费 tokens
          deferred.resolve({
            diff,
            diagnosticInfos,
          });
        } else {
          // 用户全部取消
          codeBlock.status = 'cancelled';
          deferred.resolve();
        }
        toDispose.dispose();
        this.editorListenerMap.disposeKey(uriString);
      }
    });
    this.editorListenerMap.set(uriString, toDispose);
    return deferred.promise;
  }

  protected getDiffResult(originalContent: string, appliedResult: string, relativePath: string) {
    const diffResult = createPatch(relativePath, originalContent, appliedResult).split('\n').slice(4).join('\n');
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
    return {
      diff: diffResult,
      rangesFromDiffHunk,
    };
  }

  /**
   * Apply changes of a code block, return stream to render inline diff in stream mode, result to render inline diff directly
   * range is optional, if not provided, the result will be applied to the the full file
   */
  protected abstract doApply(codeBlock: CodeBlockData): Promise<{
    range?: Range;
    stream?: SumiReadableStream<IChatProgress, Error>;
    result?: string;
  }>;

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
