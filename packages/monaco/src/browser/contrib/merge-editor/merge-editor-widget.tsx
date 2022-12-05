import React from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { AppConfig, ConfigProvider } from '@opensumi/ide-core-browser';
import { IMergeEditorEditor } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { Disposable, IRange, ISelection } from '@opensumi/ide-core-common';
import { Selection } from '@opensumi/monaco-editor-core';
import { IDisposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import { IDimension } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/dimension';
import {
  IEditorAction,
  IEditorDecorationsCollection,
  IEditorModel,
  IEditorViewState,
  ScrollType,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { IModelDecorationsChangeAccessor, ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

import { ICodeEditor, IDiffEditorOptions, IEditorOptions, IModelDeltaDecoration } from '../../monaco-api/editor';
import { IPosition, Position } from '../../monaco-api/types';

import { MergeEditorService } from './merge-editor.service';
import { Grid } from './view/grid';

export interface IMergeEditorModel {
  ours: ITextModel;
  result: ITextModel;
  theirs: ITextModel;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IMergeEditorEditorConstructionOptions extends IDiffEditorOptions {}

let MERGE_EDITOR_ID = 0;

@Injectable({ multiple: true })
export class MergeEditorWidget extends Disposable implements IMergeEditorEditor {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly configContext: AppConfig;

  @Autowired(MergeEditorService)
  private readonly mergeEditorService: MergeEditorService;

  private readonly _id: number;

  constructor(
    private readonly rootHtmlElement: HTMLElement,
    private readonly options: IMergeEditorEditorConstructionOptions,
    overrides: { [key in string]: any },
  ) {
    super();

    this._id = ++MERGE_EDITOR_ID;

    this.layout();
  }

  open(oursTextModel: ITextModel, resultTextModel: ITextModel, theirsTextModel: ITextModel): Promise<void> {
    this.getOursEditor().updateOptions(this.options);
    this.getTheirsEditor().updateOptions(this.options);
    this.getResultEditor().updateOptions(this.options);

    this.setModel({
      ours: oursTextModel,
      result: resultTextModel,
      theirs: theirsTextModel,
    });

    this.compare();

    return Promise.resolve();
  }

  compare(): Promise<void> {
    return this.mergeEditorService.compare();
  }

  getOursEditor(): ICodeEditor {
    return this.mergeEditorService.getCurrentEditor()!;
  }

  getResultEditor(): ICodeEditor {
    return this.mergeEditorService.getResultEditor()!;
  }

  getTheirsEditor(): ICodeEditor {
    return this.mergeEditorService.getIncomingEditor()!;
  }

  getCodeEditorCollect(): ICodeEditor[] {
    return [];
  }

  onDidDispose(listener: () => void): IDisposable {
    return this;
  }

  getId(): string {
    return this.getEditorType() + ':' + this._id;
  }

  getEditorType(): string {
    return 'MERGE_EDITOR_DIFF';
  }

  updateOptions(newOptions: IEditorOptions): void {}

  onVisible(): void {}

  onHide(): void {}

  layout(dimension?: IDimension): void {
    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <Grid></Grid>
      </ConfigProvider>,
      this.rootHtmlElement,
    );
  }

  focus(): void {}

  hasTextFocus(): boolean {
    return false;
  }

  getSupportedActions(): IEditorAction[] {
    return [];
  }

  saveViewState(): IEditorViewState | null {
    return null;
  }

  restoreViewState(state: IEditorViewState | null): void {}

  getVisibleColumnFromPosition(position: IPosition): number {
    return 1;
  }

  getStatusbarColumn(position: IPosition): number {
    return 1;
  }

  getPosition(): Position | null {
    return null;
  }

  setPosition(position: IPosition, source?: string): void {}

  revealLine(lineNumber: number, scrollType?: ScrollType): void {}

  revealLineInCenter(lineNumber: number, scrollType?: ScrollType): void {}

  revealLineInCenterIfOutsideViewport(lineNumber: number, scrollType?: ScrollType): void {}

  revealLineNearTop(lineNumber: number, scrollType?: ScrollType): void {}

  revealPosition(position: IPosition, scrollType?: ScrollType): void {}

  revealPositionInCenter(position: IPosition, scrollType?: ScrollType): void {}

  revealPositionInCenterIfOutsideViewport(position: IPosition, scrollType?: ScrollType): void {}

  revealPositionNearTop(position: IPosition, scrollType?: ScrollType): void {}

  getSelection(): Selection | null {
    return null;
  }

  getSelections(): Selection[] | null {
    return null;
  }

  setSelection(selection: IRange | Range | ISelection | Selection, source?: string): void;
  setSelection(selection: any, source?: any): void {}

  setSelections(selections: readonly ISelection[], source?: string): void {}

  revealLines(startLineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {}

  revealLinesInCenter(lineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {}

  revealLinesInCenterIfOutsideViewport(lineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {}

  revealLinesNearTop(lineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {}

  revealRange(range: IRange, scrollType?: ScrollType): void {}

  revealRangeInCenter(range: IRange, scrollType?: ScrollType): void {}

  revealRangeAtTop(range: IRange, scrollType?: ScrollType): void {}

  revealRangeInCenterIfOutsideViewport(range: IRange, scrollType?: ScrollType): void {}

  revealRangeNearTop(range: IRange, scrollType?: ScrollType): void {}

  revealRangeNearTopIfOutsideViewport(range: IRange, scrollType?: ScrollType): void {}

  trigger(source: string | null | undefined, handlerId: string, payload: any): void {}

  getModel(): IEditorModel | null {
    return null;
  }

  setModel(model: IEditorModel | IMergeEditorModel | null): void {
    const mergeModel = model as IMergeEditorModel;
    this.getOursEditor().setModel(mergeModel.ours);
    this.getResultEditor().setModel(mergeModel.result);
    this.getTheirsEditor().setModel(mergeModel.theirs);
  }

  createDecorationsCollection(decorations?: IModelDeltaDecoration[]): IEditorDecorationsCollection {
    throw Error('Method not implemented.');
  }

  changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any) {}
}
