import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, ErrorResponse, ReplyResponse } from '@opensumi/ide-core-common';
import { EOL, ICodeEditor, IPosition, ITextModel, Position, Selection } from '@opensumi/ide-monaco';
import { DefaultEndOfLine } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { createTextBuffer } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { ModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/modelService';

import { EResultKind } from '../inline-chat/inline-chat.service';
import { AIInlineContentWidget } from '../inline-chat/inline-content-widget';
import { EComputerMode, InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';

import { InlineDiffWidget } from './inline-diff-widget';

@Injectable({ multiple: true })
export abstract class BaseInlineDiffPreviewer<N> extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  protected inlineContentWidget: AIInlineContentWidget;

  constructor(protected readonly monacoEditor: ICodeEditor, protected readonly selection: Selection) {
    super();
    this.node = this.createNode();
  }

  get model(): ITextModel {
    return this.monacoEditor.getModel()!;
  }

  protected node: N;
  public getNode(): N {
    return this.node;
  }

  public mount(contentWidget: AIInlineContentWidget): void {
    this.inlineContentWidget = contentWidget;
  }

  abstract onReady(exec: () => void): Disposable;
  abstract onLayout(exec: () => void): Disposable;
  abstract createNode(): N;
  abstract onData(data: ReplyResponse): void;
  abstract handleAction(action: EResultKind): void;

  getPosition(): IPosition | undefined {
    return undefined;
  }

  show(line: number, heightInLines: number): void {
    // do nothing
  }

  onLineCount(evetn: (count: number) => void): Disposable {
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
  onError(error: ErrorResponse): void {
    // do nothing
  }
  onAbort(): void {
    // do nothing
  }
  onEnd(): void {
    // do nothing
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
  getPosition(): IPosition | undefined {
    return Position.lift({ lineNumber: this.selection.endLineNumber + 1, column: 1 });
  }
  onLayout(exec: () => void): Disposable {
    requestAnimationFrame(() => exec());
    return this;
  }
  onReady(exec: () => void): Disposable {
    this.addDispose(this.node.onReady(exec.bind(this)));
    return this;
  }
  show(line: number, heightInLines: number): void {
    this.node.showByLine(line, heightInLines);
  }
  setValue(content: string): void {
    const modifiedModel = this.node.getModifiedModel();
    modifiedModel?.setValue(content);
  }
  getValue(): string {
    const model = this.node.getModifiedModel();
    return model!.getValue();
  }
  handleAction(action: EResultKind): void {
    if (action === EResultKind.ACCEPT) {
      const newValue = this.getValue();
      this.model.pushEditOperations(null, [{ range: this.selection, text: newValue }], () => null);
    }
  }
  onLineCount(event: (count: number) => void): Disposable {
    this.node.onMaxLineCount(event.bind(this));
    return this;
  }
  onData(data: ReplyResponse): void {
    const { message } = data;
    const modifiedModel = this.node.getModifiedModel()!;

    const defaultEOL = modifiedModel.getEOL() === EOL.CRLF ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF;
    const { textBuffer, disposable } = createTextBuffer(message, defaultEOL);
    const singleEditOperation = ModelService._computeEdits(modifiedModel, textBuffer);
    modifiedModel.pushEditOperations([], singleEditOperation, () => []);

    disposable.dispose();
    this.node.layout();
  }
  onError(error: ErrorResponse): void {
    this.node.layout();
  }
  onAbort(): void {
    this.node.layout();
  }
  onEnd(): void {
    this.node.layout();
  }
}

@Injectable({ multiple: true })
export class LiveInlineDiffPreviewer extends BaseInlineDiffPreviewer<InlineStreamDiffHandler> {
  onReady(exec: () => void): Disposable {
    exec();
    return this;
  }
  createNode(): InlineStreamDiffHandler {
    const node = this.injector.get(InlineStreamDiffHandler, [this.monacoEditor, this.selection]);
    this.addDispose(node.onDispose(() => this.dispose()));
    this.addDispose(node);

    node.registerPartialEditWidgetHandle((widgets) => {
      if (widgets.every((widget) => widget.isHidden)) {
        this.dispose();
        this.inlineContentWidget.dispose();
      }
    });
    return node;
  }
  getPosition(): IPosition | undefined {
    const zone = this.node.getZone();
    return Position.lift({ lineNumber: Math.max(0, zone.startLineNumber - 1), column: 1 });
  }
  handleAction(action: EResultKind): void {
    switch (action) {
      case EResultKind.ACCEPT:
        this.node.dispose();
        break;

      case EResultKind.DISCARD:
      case EResultKind.REGENERATE:
        this.node.discard();
        this.node.dispose();
        break;

      default:
        break;
    }
  }
  onLayout(exec: () => void): Disposable {
    this.node.onDidEditChange(exec.bind(this));
    return this;
  }
  onData(data: ReplyResponse): void {
    const { message } = data;
    this.node.addLinesToDiff(message);
  }
  onEnd(): void {
    const diffModel = this.node.recompute(EComputerMode.legacy);
    this.node.readyRender(diffModel);
  }
}
