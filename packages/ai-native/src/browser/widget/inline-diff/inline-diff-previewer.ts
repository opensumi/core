import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AI_DIFF_WIDGET_ID } from '@opensumi/ide-ai-native/lib/common/index';
import { Disposable, ErrorResponse, ReplyResponse } from '@opensumi/ide-core-common';
import { ICodeEditor, Range } from '@opensumi/ide-monaco';

import { EComputerMode, InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';

import { InlineDiffWidget } from './inline-diff-widget';

@Injectable({ multiple: true })
export abstract class BaseInlineDiffPreviewer<N> extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  constructor(protected readonly monacoEditor: ICodeEditor, protected readonly selection: Selection) {
    super();
    this.node = this.createNode();
  }

  protected node: N;
  public getNode(): N {
    return this.node;
  }

  abstract onReady(exec: () => void): Disposable;
  abstract createNode(): N;
  abstract show(line: number, heightInLines: number): void;

  abstract setValue(content: string): void;
  abstract getValue(): string;
  abstract onLineCount(evetn: (count: number) => void): Disposable;

  abstract onData(data: ReplyResponse): void;
  abstract onError(error: ErrorResponse): void;
  abstract onAbort(): void;
  abstract onEnd(): void;
}

@Injectable({ multiple: true })
export class SideBySideInlineDiffWidget extends BaseInlineDiffPreviewer<InlineDiffWidget> {
  createNode(): InlineDiffWidget {
    const widget = this.injector.get(InlineDiffWidget, [
      AI_DIFF_WIDGET_ID,
      {
        editor: this.monacoEditor,
        selection: this.selection,
      },
    ]);
    widget.create();
    this.addDispose(
      Disposable.create(() => {
        widget.dispose();
      }),
    );
    return widget;
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
  onLineCount(event: (count: number) => void): Disposable {
    this.node.onMaxLineCount(event.bind(this));
    return this;
  }
  onData(data: ReplyResponse): void {
    const { message } = data;
    const modifiedModel = this.node.getModifiedModel();

    const lastLine = modifiedModel!.getLineCount();
    const lastColumn = modifiedModel!.getLineMaxColumn(lastLine);

    const range = new Range(lastLine, lastColumn, lastLine, lastColumn);

    const edit = {
      range,
      text: message || '',
    };
    modifiedModel!.pushEditOperations(null, [edit], () => null);
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
    this.addDispose(
      Disposable.create(() => {
        node.dispose();
      }),
    );
    return node;
  }
  show(line: number, heightInLines: number): void {
    // do nothing
  }
  setValue(content: string): void {
    throw new Error('Method not implemented.');
  }
  getValue(): string {
    throw new Error('Method not implemented.');
  }
  onLineCount(evetn: (count: number) => void): Disposable {
    return this;
  }
  onData(data: ReplyResponse): void {
    const { message } = data;
    this.node.addLinesToDiff(message);
  }
  onError(error: ErrorResponse): void {
    // do nothing
  }
  onAbort(): void {
    // do nothing
  }
  onEnd(): void {
    this.node.recompute(EComputerMode.legacy);
  }
}
