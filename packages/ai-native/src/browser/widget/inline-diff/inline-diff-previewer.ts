import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, ErrorResponse, IDisposable, ReplyResponse } from '@opensumi/ide-core-common';
import { EOL, ICodeEditor, IPosition, ITextModel, Position, Selection } from '@opensumi/ide-monaco';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { DefaultEndOfLine } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { createTextBuffer } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { ModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/modelService';

import { EResultKind } from '../inline-chat/inline-chat.service';
import { AIInlineContentWidget } from '../inline-chat/inline-content-widget';
import { EComputerMode, InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';
import { SerializableState } from '../inline-stream-diff/live-preview.decoration';

import { InlineDiffWidget } from './inline-diff-widget';

@Injectable({ multiple: true })
export abstract class BaseInlineDiffPreviewer<N extends IDisposable> extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  protected inlineContentWidget: AIInlineContentWidget | null = null;

  protected model: ITextModel;

  constructor(protected readonly monacoEditor: ICodeEditor, protected readonly selection: Selection) {
    super();
    this.node = this.createNode();
    this.model = this.monacoEditor.getModel()!;
    this.addDispose(
      Disposable.create(() => {
        if (this.inlineContentWidget) {
          this.inlineContentWidget.dispose();
        }
        if (this.node) {
          this.node.dispose();
        }
      }),
    );
  }

  protected node: N;
  public getNode(): N {
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

  abstract createNode(): N;
  abstract onData(data: ReplyResponse): void;
  abstract handleAction(action: EResultKind): void;
  abstract getPosition(): IPosition;

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
  getPosition(): IPosition {
    return Position.lift({ lineNumber: this.selection.endLineNumber + 1, column: 1 });
  }
  layout(): void {
    this.inlineContentWidget?.setPositionPreference([ContentWidgetPositionPreference.BELOW]);
    super.layout();
  }
  onReady(exec: () => void): IDisposable {
    return this.node.onReady(exec.bind(this));
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
      this.model.pushStackElement();
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
  createNode(): InlineStreamDiffHandler {
    const node = this.injector.get(InlineStreamDiffHandler, [this.monacoEditor, this.selection]);

    this.addDispose(node.onDidEditChange(() => this.layout()));
    this.addDispose(node.onDispose(() => this.dispose()));
    this.addDispose(node);

    this.addDispose(
      node.onPartialEditWidgetListChange((widgets) => {
        if (widgets.every((widget) => widget.isHidden)) {
          this.dispose();
          this.inlineContentWidget?.dispose();
        }
      }),
    );
    return node;
  }
  getPosition(): IPosition {
    const zone = this.node.getZone();
    return Position.lift({ lineNumber: Math.max(0, zone.startLineNumber - 1), column: 1 });
  }

  handleAction(action: EResultKind): void {
    switch (action) {
      case EResultKind.ACCEPT:
        this.node.acceptAll();
        break;

      case EResultKind.DISCARD:
      case EResultKind.REGENERATE:
        this.node.rejectAll();
        break;

      default:
        break;
    }
  }
  onLineCount() {
    return Disposable.NULL;
  }
  layout(): void {
    this.inlineContentWidget?.setPositionPreference([ContentWidgetPositionPreference.EXACT]);
    super.layout();
  }
  onData(data: ReplyResponse): void {
    const { message } = data;
    this.node.addLinesToDiff(message);
  }
  onEnd(): void {
    const diffModel = this.node.recompute(EComputerMode.legacy);
    this.node.readyRender(diffModel);
  }
  setValue(content: string): void {
    this.node.addLinesToDiff(content);
    this.onEnd();
  }
  serializeState(): SerializableState {
    return this.node.serializeState();
  }
  restoreState(state: SerializableState): void {
    this.node.restoreState(state);
  }
  get onPartialEditEvent() {
    return this.node.onPartialEditEvent;
  }
  revealFirstDiff(): void {
    this.node.revealFirstDiff();
  }
}
