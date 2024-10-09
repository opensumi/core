import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, ErrorResponse, IDisposable, ReplyResponse } from '@opensumi/ide-core-common';
import { EOL, ICodeEditor, IPosition, ITextModel, Position, Selection } from '@opensumi/ide-monaco';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { empty, getLeadingWhitespace } from '@opensumi/ide-utils/lib/strings';
import { DefaultEndOfLine } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { createTextBuffer } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { ModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/modelService';
import {
  generateIndent,
  getSpaceCnt,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/indentation/browser/indentUtils';

import { EResultKind } from '../inline-chat/inline-chat.service';
import { AIInlineContentWidget } from '../inline-chat/inline-content-widget';
import { EComputerMode, InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';

import { InlineDiffWidget } from './inline-diff-widget';

export interface IDiffPreviewerOptions {
  disposeWhenEditorClosed: boolean;
  /**
   * 是否隐藏接受部分编辑的 widget，用于只展示 diff 的场景
   */
  hideAcceptPartialEditWidget?: boolean;
}

export interface IInlineDiffPreviewerNode extends IDisposable {
  previewerOptions: IDiffPreviewerOptions;
  setPreviewerOptions(options: IDiffPreviewerOptions): void;
}

@Injectable({ multiple: true })
export abstract class BaseInlineDiffPreviewer<N extends IInlineDiffPreviewerNode> extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  protected inlineContentWidget: AIInlineContentWidget | null = null;
  protected selection: Selection;
  protected model: ITextModel;

  constructor(protected readonly monacoEditor: ICodeEditor) {
    super();
    this.model = this.monacoEditor.getModel()!;
    this.addDispose(
      Disposable.create(() => {
        if (this.inlineContentWidget) {
          this.inlineContentWidget.dispose();
        }

        this.attachNode(undefined);
      }),
    );
  }

  protected formatIndentation(content: string): string {
    const startLineNumber = this.selection.startLineNumber;
    const oldIndentation = getLeadingWhitespace(this.model.getLineContent(startLineNumber));
    if (content === empty) {
      return content;
    }
    if (oldIndentation === empty) {
      return content;
    }
    const { tabSize, insertSpaces } = this.model.getOptions();
    const eol = this.model.getEOL();
    const originalSpacesCnt = getSpaceCnt(oldIndentation, tabSize);

    let newIndentation = generateIndent(originalSpacesCnt, tabSize, insertSpaces);

    const linesText = content.split(eol);

    const firstLines = linesText[0];
    let isShrinkLeft = false;
    if (firstLines) {
      const firstIndentation = getLeadingWhitespace(firstLines);
      if (newIndentation === firstIndentation) {
        newIndentation = '';
      } else if (newIndentation.length > firstIndentation.length) {
        newIndentation = newIndentation.slice(firstIndentation.length);
      } else {
        newIndentation = firstIndentation.slice(newIndentation.length);
        isShrinkLeft = true;
      }
    }

    const newTextLines = linesText.map((content) => {
      if (isShrinkLeft) {
        const currentIndentation = getLeadingWhitespace(content);
        content = newIndentation + content.substring(currentIndentation.length);
        return content;
      }

      return newIndentation + content;
    });
    return newTextLines.join(eol);
  }

  protected node: N | undefined;
  public getNode(): N | undefined {
    return this.node;
  }

  public createNodeSnapshot(): N | undefined {
    return this.node;
  }

  public mount(contentWidget: AIInlineContentWidget): void {
    this.inlineContentWidget = contentWidget;
  }

  public layout(): void {
    this.inlineContentWidget?.setOptions({ position: this.getPosition() });
    this.inlineContentWidget?.layoutContentWidget();
  }

  public onReady(exec: () => void): IDisposable {
    exec();
    return Disposable.NULL;
  }

  protected abstract createNode(): N;
  abstract onData(data: ReplyResponse): void;
  abstract handleAction(action: EResultKind): void;
  abstract getPosition(): IPosition;

  create(
    selection: Selection,
    options: IDiffPreviewerOptions = {
      disposeWhenEditorClosed: true,
    },
  ): void {
    this.selection = selection;
    this.node = this.createNode();
    this.node.setPreviewerOptions(options);
  }

  attachNode(node: N | undefined): void {
    this.node = node;
  }

  show(line: number, heightInLines: number): void {
    // do nothing
  }

  onLineCount(event: (count: number) => void): IDisposable {
    // do nothing
    return this;
  }

  setValue(content: string): void {
    // do nothing
  }
  getValue(): string {
    // do nothing
    return '';
  }
  getOriginValue(): string {
    // do nothing
    return '';
  }
  onError(error: ErrorResponse): void {
    // do nothing
  }
  onAbort(): void {
    // do nothing
  }
  onEnd(): void {
    // do nothing
  }

  revealFirstDiff(): void {
    // do nothing
  }

  isModel(uri: string): boolean {
    return this.model.uri.toString() === uri;
  }
}

@Injectable({ multiple: true })
export class SideBySideInlineDiffWidget extends BaseInlineDiffPreviewer<InlineDiffWidget> {
  static AI_DIFF_WIDGET_ID = 'AI-DIFF-WIDGET';

  createNode(): InlineDiffWidget {
    const widget = this.injector.get(InlineDiffWidget, [
      SideBySideInlineDiffWidget.AI_DIFF_WIDGET_ID,
      {
        editor: this.monacoEditor,
        selection: this.selection,
      },
    ]);
    widget.create();
    this.addDispose(widget);
    return widget;
  }
  mount(contentWidget: AIInlineContentWidget): void {
    super.mount(contentWidget);
    contentWidget.addDispose(this);
  }
  getPosition(): IPosition {
    return Position.lift({ lineNumber: this.selection.endLineNumber + 1, column: 1 });
  }
  layout(): void {
    this.inlineContentWidget?.setPositionPreference([ContentWidgetPositionPreference.BELOW]);
    super.layout();
  }
  onReady(exec: () => void): IDisposable {
    if (this.node) {
      return this.node!.onReady(exec.bind(this));
    }
    return Disposable.NULL;
  }
  show(line: number, heightInLines: number): void {
    this.node?.showByLine(line, heightInLines);
  }
  setValue(content: string): void {
    const modifiedModel = this.node?.getModifiedModel();
    modifiedModel?.setValue(this.formatIndentation(content));
  }
  getValue(): string {
    const model = this.node?.getModifiedModel();
    return model!.getValue();
  }

  getOriginValue(): string {
    const model = this.node?.getOriginModel();
    return model!.getValue() || '';
  }

  handleAction(action: EResultKind): void {
    if (action === EResultKind.ACCEPT) {
      const newValue = this.getValue();
      this.model.pushEditOperations(null, [{ range: this.selection, text: newValue }], () => null);
      this.model.pushStackElement();
    }
  }
  onLineCount(event: (count: number) => void): Disposable {
    this.node?.onMaxLineCount(event.bind(this));
    return this;
  }
  onData(data: ReplyResponse): void {
    const { message } = data;

    const indentMessage = this.formatIndentation(message);
    const modifiedModel = this.node?.getModifiedModel()!;

    const defaultEOL = modifiedModel.getEOL() === EOL.CRLF ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF;
    const { textBuffer, disposable } = createTextBuffer(indentMessage, defaultEOL);
    const singleEditOperation = ModelService._computeEdits(modifiedModel, textBuffer);
    modifiedModel.pushEditOperations([], singleEditOperation, () => []);

    disposable.dispose();
    this.node?.layout();
  }
  onError(error: ErrorResponse): void {
    this.node?.layout();
  }
  onAbort(): void {
    this.node?.layout();
  }
  onEnd(): void {
    this.node?.layout();
  }
}

@Injectable({ multiple: true })
export class LiveInlineDiffPreviewer extends BaseInlineDiffPreviewer<InlineStreamDiffHandler> {
  private listenNode(node: InlineStreamDiffHandler): void {
    node.addDispose(node.onDidEditChange(() => this.layout()));
    node.addDispose(
      node.onPartialEditWidgetListChange((widgets) => {
        if (widgets.every((widget) => widget.isHidden)) {
          this.dispose();
          this.inlineContentWidget?.dispose();
        }
      }),
    );

    const dispose = node.onDispose(() => {
      this.dispose();
      dispose.dispose();
    });

    this.addDispose(node);
  }

  createNode(): InlineStreamDiffHandler {
    const node = this.injector.get(InlineStreamDiffHandler, [this.monacoEditor]);
    node.initialize(this.selection);
    this.listenNode(node);
    return node;
  }
  attachNode(node: InlineStreamDiffHandler): void {
    this.node?.dispose();
    this.node = node;

    if (node) {
      const snapshot = node.currentSnapshotStore;
      if (snapshot) {
        this.node.restoreDecorationSnapshot(snapshot.decorationSnapshotData);
        this.listenNode(node);
      }
    }
  }
  public createNodeSnapshot(): InlineStreamDiffHandler | undefined {
    if (!this.node) {
      return this.createNode();
    }

    // 拿前一个 node 的快照信息
    const snapshot = this.node.createSnapshot();
    // 创建新的实例
    const node = this.injector.get(InlineStreamDiffHandler, [this.monacoEditor]);
    node.restoreSnapshot(snapshot);
    return node;
  }

  getPosition(): IPosition {
    const zone = this.node?.getZone();
    if (zone) {
      return Position.lift({ lineNumber: zone.startLineNumber, column: 1 });
    }
    return Position.lift({ lineNumber: 1, column: 1 });
  }
  handleAction(action: EResultKind): void {
    switch (action) {
      case EResultKind.ACCEPT:
        this.node?.acceptAll();
        break;

      case EResultKind.DISCARD:
      case EResultKind.REGENERATE:
        this.node?.rejectAll();
        break;

      default:
        break;
    }
  }
  onLineCount() {
    return Disposable.NULL;
  }
  layout(): void {
    this.inlineContentWidget?.setPositionPreference([
      ContentWidgetPositionPreference.ABOVE,
      ContentWidgetPositionPreference.BELOW,
    ]);
    super.layout();

    const position = this.getPosition();
    if (position && this.inlineContentWidget) {
      // 如果第一个 removed widget 的 lineNumber 和 position 的 lineNumber 相等，则需要将 inline content widget 往上移动被删除的行数，避免遮挡
      const removedWidgets = this.node?.livePreviewDiffDecorationModel.getRemovedWidgets();
      if (removedWidgets?.length) {
        const lineNumber = position.lineNumber;
        const firstRemovedWidget = removedWidgets[0];

        if (firstRemovedWidget) {
          const firstRemovedWidgetLineNumber = firstRemovedWidget.getLastPosition()?.lineNumber;
          if (firstRemovedWidgetLineNumber <= lineNumber) {
            const lineHeight = this.inlineContentWidget.getLineHeight();
            const len = firstRemovedWidget.height;
            this.inlineContentWidget.setOffsetTop(-lineHeight * len - 4);
          }
        }
      }
    }
  }
  onData(data: ReplyResponse): void {
    const { message } = data;
    this.node?.addLinesToDiff(this.formatIndentation(message));
  }
  onEnd(): void {
    const diffModel = this.node?.recompute(EComputerMode.legacy);
    if (diffModel) {
      this.node?.pushRateFinallyDiffStack(diffModel);
    }
  }

  getValue(): string {
    return this.node?.getVirtualModelValue() || '';
  }

  getOriginValue(): string {
    return this.node?.getOriginModelValue() || '';
  }

  setValue(content: string): void {
    const diffModel = this.node?.recompute(EComputerMode.legacy, this.formatIndentation(content));
    if (diffModel) {
      this.node?.finallyRender(diffModel);
    }
  }
  get onPartialEditEvent() {
    return this.node?.onPartialEditEvent;
  }
  revealFirstDiff(): void {
    this.node?.revealFirstDiff();
  }
}
