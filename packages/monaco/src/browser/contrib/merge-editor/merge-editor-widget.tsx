import React from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { AppConfig, ConfigProvider, MonacoService } from '@opensumi/ide-core-browser';
import { Disposable, IRange, ISelection } from '@opensumi/ide-core-common';
import { Selection } from '@opensumi/monaco-editor-core';
import { IDisposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import { IDimension } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/dimension';
import {
  IEditor,
  IEditorAction,
  IEditorDecorationsCollection,
  IEditorModel,
  IEditorViewState,
  ScrollType,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { IModelDecorationsChangeAccessor } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

import { ICodeEditor, IEditorOptions, IModelDeltaDecoration } from '../../monaco-api/editor';
import { IPosition, Position } from '../../monaco-api/types';
import MonacoServiceImpl from '../../monaco.service';

import { Grid } from './view/grid';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IMergeEditorEditorConstructionOptions {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IMergeEditorEditor extends IEditor {}

@Injectable({ multiple: true })
export class MergeEditorWidget extends Disposable implements IMergeEditorEditor {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(MonacoService)
  private readonly monacoService: MonacoServiceImpl;

  @Autowired(AppConfig)
  private readonly configContext: AppConfig;

  constructor(private readonly rootHtmlElement: HTMLElement, options: IMergeEditorEditorConstructionOptions) {
    super();
  }
  onDidDispose(listener: () => void): IDisposable {
    // Method not implemented
    return this;
  }
  getId(): string {
    return 'mergeEditor';
  }
  getEditorType(): string {
    // Method not implemented
    return '';
  }
  updateOptions(newOptions: IEditorOptions): void {
    // Method not implemented
  }
  onVisible(): void {
    // Method not implemented
  }
  onHide(): void {
    // Method not implemented
  }
  layout(dimension?: IDimension): void {
    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <Grid></Grid>
      </ConfigProvider>,
      this.rootHtmlElement,
    );
  }
  focus(): void {
    // Method not implemented
  }
  hasTextFocus(): boolean {
    // Method not implemented
    return false;
  }
  getSupportedActions(): IEditorAction[] {
    // Method not implemented
    return [];
  }
  saveViewState(): IEditorViewState | null {
    // Method not implemented
    return null;
  }
  restoreViewState(state: IEditorViewState | null): void {
    // Method not implemented
  }
  getVisibleColumnFromPosition(position: IPosition): number {
    // Method not implemented
    return 1;
  }
  getStatusbarColumn(position: IPosition): number {
    // Method not implemented
    return 1;
  }
  getPosition(): Position | null {
    // Method not implemented
    return null;
  }
  setPosition(position: IPosition, source?: string): void {
    // Method not implemented
  }
  revealLine(lineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealLineInCenter(lineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealLineInCenterIfOutsideViewport(lineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealLineNearTop(lineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealPosition(position: IPosition, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealPositionInCenter(position: IPosition, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealPositionInCenterIfOutsideViewport(position: IPosition, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealPositionNearTop(position: IPosition, scrollType?: ScrollType): void {
    // Method not implemented
  }
  getSelection(): Selection | null {
    // Method not implemented
    return null;
  }
  getSelections(): Selection[] | null {
    // Method not implemented
    return null;
  }
  setSelection(selection: IRange | Range | ISelection | Selection, source?: string): void;
  setSelection(selection: any, source?: any): void {
    // Method not implemented
  }
  setSelections(selections: readonly ISelection[], source?: string): void {
    // Method not implemented
  }
  revealLines(startLineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealLinesInCenter(lineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealLinesInCenterIfOutsideViewport(lineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealLinesNearTop(lineNumber: number, endLineNumber: number, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealRange(range: IRange, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealRangeInCenter(range: IRange, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealRangeAtTop(range: IRange, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealRangeInCenterIfOutsideViewport(range: IRange, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealRangeNearTop(range: IRange, scrollType?: ScrollType): void {
    // Method not implemented
  }
  revealRangeNearTopIfOutsideViewport(range: IRange, scrollType?: ScrollType): void {
    // Method not implemented
  }
  trigger(source: string | null | undefined, handlerId: string, payload: any): void {
    // Method not implemented
  }
  getModel(): IEditorModel | null {
    // Method not implemented
    return null;
  }
  setModel(model: IEditorModel | null): void {
    // Method not implemented
  }
  createDecorationsCollection(decorations?: IModelDeltaDecoration[]): IEditorDecorationsCollection {
    throw Error('Method not implemented.');
  }
  changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any) {
    // Method not implemented
  }
}
