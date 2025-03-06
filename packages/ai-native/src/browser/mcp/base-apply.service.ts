import { createPatch } from 'diff';

import { Autowired } from '@opensumi/di';
import {
  AIServiceType,
  ActionSourceEnum,
  ActionTypeEnum,
  AppConfig,
  IAIReporter,
  IChatProgress,
  IMarker,
  MarkerSeverity,
  OnEvent,
  WithEventBus,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorGroupCloseEvent,
  EditorGroupOpenEvent,
  IEditorDocumentModelService,
  RegisterEditorSideComponentEvent,
} from '@opensumi/ide-editor/lib/browser';
import { IMarkerService } from '@opensumi/ide-markers';
import { ICodeEditor, ITextModel, Position, Range, Selection, SelectionDirection } from '@opensumi/ide-monaco';
import { Deferred, DisposableMap, Emitter, IDisposable, URI, path } from '@opensumi/ide-utils';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';

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

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private onCodeBlockUpdateEmitter = new Emitter<CodeBlockData>();
  public onCodeBlockUpdate = this.onCodeBlockUpdateEmitter.event;

  private currentSessionId?: string;

  constructor() {
    super();
    this.addDispose(
      this.chatInternalService.onCancelRequest(() => {
        const currentMessageId = this.chatInternalService.sessionModel.history.lastMessageId;
        if (!currentMessageId) {
          return;
        }
        const codeBlockMap = this.getMessageCodeBlocks(currentMessageId);
        if (!codeBlockMap) {
          return;
        }
        Object.values(codeBlockMap).forEach((blockData) => {
          this.cancelApply(blockData);
        });
      }),
    );
    this.currentSessionId = this.chatInternalService.sessionModel.sessionId;
    this.addDispose(
      this.chatInternalService.onChangeSession((sessionId) => {
        if (sessionId !== this.currentSessionId) {
          this.cancelAllApply();
          this.currentSessionId = sessionId;
        }
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
    this.addDispose(
      this.chatInternalService.onWillClearSession((sessionId) => {
        this.cancelAllApply(sessionId);
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
    const filePendingApplies =
      this.getUriCodeBlocks(event.payload.resource.uri)?.filter((block) => block.status === 'pending') || [];
    // 使用最后一个版本内容渲染 apply 内容
    if (filePendingApplies.length > 0 && filePendingApplies[0].updatedCode) {
      const editor = event.payload.group.codeEditor.monacoEditor;
      this.renderApplyResult(editor, filePendingApplies[0], filePendingApplies[0].updatedCode);
    }
  }

  get currentPreviewer() {
    const currentUri = this.editorService.currentEditor?.currentUri;
    if (!currentUri) {
      return undefined;
    }
    return this.activePreviewerMap.get(path.relative(this.appConfig.workspaceDir, currentUri.path.toString()));
  }

  /**
   * 获取指定uri的 code block，按version降序排序
   */
  getUriCodeBlocks(uri: URI): CodeBlockData[] | undefined {
    const sessionCodeBlocks = this.getSessionCodeBlocks();
    const relativePath = path.relative(this.appConfig.workspaceDir, uri.path.toString());
    return sessionCodeBlocks
      .filter((block) => block.relativePath === relativePath)
      .sort((a, b) => b.version - a.version);
  }

  getPendingPaths(sessionId?: string): string[] {
    const sessionCodeBlocks = this.getSessionCodeBlocks(sessionId);
    return sessionCodeBlocks.filter((block) => block.status === 'pending').map((block) => block.relativePath);
  }

  protected getSessionCodeBlocks(sessionId?: string) {
    sessionId = sessionId || this.chatInternalService.sessionModel.sessionId;
    const sessionModel = this.chatInternalService.getSession(sessionId);
    if (!sessionModel) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const sessionAdditionals = sessionModel.history.sessionAdditionals;
    return Array.from(sessionAdditionals.values())
      .map((additional) => (additional.codeBlockMap || {}) as { [toolCallId: string]: CodeBlockData })
      .reduce((acc, cur) => {
        Object.values(cur).forEach((block) => {
          acc.push(block);
        });
        return acc;
      }, [] as CodeBlockData[]);
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

  protected updateCodeBlock(codeBlock: CodeBlockData) {
    const messageId = codeBlock.messageId;
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
    const uriCodeBlocks = this.getUriCodeBlocks(URI.file(path.join(this.appConfig.workspaceDir, relativePath)));
    const originalModelRef = await this.editorDocumentModelService.createModelReference(
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
      messageId: lastMessageId,
      // TODO: 支持range
      originalCode: originalModelRef.instance.getText(),
    };
    if (uriCodeBlocks?.length) {
      newBlock.version = uriCodeBlocks.length;
      for (const block of uriCodeBlocks) {
        // 如果连续的上一个同文件apply结果存在LintError，则iterationCount++
        if (block.relativePath === relativePath && block.applyResult?.diagnosticInfos?.length) {
          newBlock.iterationCount++;
        } else {
          break;
        }
      }
    }
    const savedCodeBlockMap = this.getMessageCodeBlocks(lastMessageId) || {};
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
      // 新建文件场景，直接返回codeEdit
      const fastApplyFileResult = !codeBlock.originalCode
        ? {
            result: codeBlock.codeEdit,
          }
        : await this.doApply(codeBlock);
      if (!fastApplyFileResult.stream && !fastApplyFileResult.result) {
        throw new Error('No apply content provided');
      }

      if (this.activePreviewerMap.has(codeBlock.relativePath)) {
        // 有正在进行的 apply，则取消（但不更新block状态，只清理副作用）
        this.cancelApply(codeBlock, true);
      }
      // trigger diffPreivewer & return expected diff result directly
      const result = await this.editorService.open(
        URI.file(path.join(this.appConfig.workspaceDir, codeBlock.relativePath)),
      );
      if (!result) {
        throw new Error('Failed to open file');
      }
      if (typeof fastApplyFileResult.result === 'string') {
        codeBlock.updatedCode = fastApplyFileResult.result;
        codeBlock.status = 'pending';
        this.updateCodeBlock(codeBlock);
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
    range = range || editor.getModel()!.getFullModelRange();

    if (typeof updatedContentOrStream === 'string') {
      const editorCurrentContent = editor.getModel()!.getValue();
      const uri = URI.file(path.join(this.appConfig.workspaceDir, codeBlock.relativePath));
      const document = this.editorDocumentModelService.getModelReference(uri);
      if (editorCurrentContent !== updatedContentOrStream || document?.instance.dirty) {
        editor.getModel()?.pushEditOperations([], [EditOperation.replace(range, updatedContentOrStream)], () => null);
        await this.editorService.save(uri);
      }
      const uriPendingCodeBlocks = this.getUriCodeBlocks(uri)?.filter((block) => block.status === 'pending');
      const earlistPendingCodeBlock = uriPendingCodeBlocks?.[uriPendingCodeBlocks.length - 1];
      if ((earlistPendingCodeBlock?.originalCode || codeBlock.originalCode) === updatedContentOrStream) {
        codeBlock.status = 'cancelled';
        this.updateCodeBlock(codeBlock);
        deferred.resolve();
        return;
      }
      // Create diff previewer
      const previewer = inlineDiffController.createDiffPreviewer(
        editor,
        Selection.fromRange(range, SelectionDirection.LTR),
        {
          disposeWhenEditorClosed: true,
          renderRemovedWidgetImmediately: true,
          reverse: true,
        },
      ) as LiveInlineDiffPreviewer;
      this.activePreviewerMap.set(codeBlock.relativePath, previewer);
      // 新建文件场景，为避免model为空，加一个空行
      previewer.setValue(earlistPendingCodeBlock?.originalCode || codeBlock.originalCode || '\n');
      // 强刷展示 manager 视图
      this.eventBus.fire(new RegisterEditorSideComponentEvent());

      this.listenPartialEdit(editor.getModel()!, codeBlock).then((result) => {
        if (result) {
          codeBlock.applyResult = result;
        }
        this.updateCodeBlock(codeBlock);
        this.editorService.save(URI.file(path.join(this.appConfig.workspaceDir, codeBlock.relativePath)));
      });

      const { diff, rangesFromDiffHunk } = this.getDiffResult(
        codeBlock.originalCode,
        codeBlock.updatedCode || updatedContentOrStream,
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

      const previewer = inlineDiffController.showPreviewerByStream(editor, {
        crossSelection: Selection.fromRange(range, SelectionDirection.LTR),
        chatResponse: controller,
        previewerOptions: {
          disposeWhenEditorClosed: true,
          renderRemovedWidgetImmediately: false,
        },
      }) as LiveInlineDiffPreviewer;

      this.addDispose(
        controller.onError((err) => {
          deferred.reject(err);
        }),
      );
      this.addDispose(
        controller.onAbort(() => {
          deferred.reject(new Error('Apply aborted'));
        }),
      );
      this.addDispose(
        // 流式输出结束后，转为直接输出逻辑
        previewer.getNode()!.onDiffFinished(async (diffModel) => {
          codeBlock.updatedCode = diffModel.newFullRangeTextLines.join('\n');
          // TODO: 添加 reapply
          // 实际应用结果为空，则取消
          if (codeBlock.updatedCode === codeBlock.originalCode) {
            codeBlock.status = 'failed';
            this.updateCodeBlock(codeBlock);
            previewer.dispose();
            deferred.reject(new Error('no changes applied'));
            return;
          }
          codeBlock.status = 'pending';
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
  cancelApply(blockData: CodeBlockData, keepStatus?: boolean): void {
    if (blockData.status === 'generating' || blockData.status === 'pending') {
      // 先取消掉相关的监听器
      this.editorListenerMap.disposeKey(
        URI.file(path.join(this.appConfig.workspaceDir, blockData.relativePath)).toString(),
      );
      if (this.activePreviewerMap.has(blockData.relativePath)) {
        this.activePreviewerMap
          .get(blockData.relativePath)
          ?.getNode()
          ?.livePreviewDiffDecorationModel.discardUnProcessed();
        this.activePreviewerMap.disposeKey(blockData.relativePath);
      }
      if (!keepStatus) {
        blockData.status = 'cancelled';
        this.updateCodeBlock(blockData);
      }
    }
  }

  cancelAllApply(sessionId?: string): void {
    const sessionCodeBlocks = this.getSessionCodeBlocks(sessionId);
    sessionCodeBlocks.forEach((blockData) => {
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
    const codeBlocks = this.getUriCodeBlocks(uri)?.filter((block) => block.status === 'pending');
    if (!codeBlocks?.length) {
      throw new Error('No pending code block found');
    }
    const decorationModel = this.activePreviewerMap
      .get(codeBlocks[0].relativePath)
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
    codeBlocks.forEach((codeBlock) => {
      codeBlock.status = type === 'accept' ? 'success' : 'cancelled';
      // TODO: 批量更新
      this.updateCodeBlock(codeBlock);
    });
  }

  protected listenPartialEdit(model: ITextModel, codeBlock: CodeBlockData) {
    const deferred = new Deferred<{ diff: string; diagnosticInfos: IMarker[] }>();
    const uriString = model.uri.toString();
    const toDispose = this.inlineDiffService.onPartialEdit((event) => {
      // TODO 支持自动保存
      if (
        event.totalPartialEditCount === event.resolvedPartialEditCount &&
        event.uri.path === model.uri.path.toString()
      ) {
        if (event.acceptPartialEditCount > 0) {
          codeBlock.status = 'success';
          const appliedResult = model.getValue();
          const { diff, rangesFromDiffHunk } = this.getDiffResult(
            codeBlock.originalCode,
            appliedResult,
            codeBlock.relativePath,
          );
          const diagnosticInfos = this.getDiagnosticInfos(model.uri.toString(), rangesFromDiffHunk);
          // 移除开头的几个固定信息，避免浪费 tokens
          this.aiReporter.send({
            msgType: AIServiceType.Chat,
            actionType: ActionTypeEnum.Accept,
            actionSource: ActionSourceEnum.Chat,
            sessionId: this.chatInternalService.sessionModel.sessionId,
            isReceive: true,
            isDrop: false,
            code: codeBlock.codeEdit,
            message: JSON.stringify({
              diff,
              diagnosticInfos,
            }),
          });
          deferred.resolve({
            diff,
            diagnosticInfos,
          });
        } else {
          // 用户全部取消
          codeBlock.status = 'cancelled';
          deferred.resolve();
          this.aiReporter.send({
            msgType: AIServiceType.Chat,
            actionType: ActionTypeEnum.Discard,
            actionSource: ActionSourceEnum.Chat,
            sessionId: this.chatInternalService.sessionModel.sessionId,
            isReceive: false,
            isDrop: true,
            code: codeBlock.codeEdit,
            originCode: codeBlock.originalCode,
          });
        }
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
