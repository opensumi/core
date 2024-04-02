import { IMergeEditorEditor, IOpenMergeEditorArgs } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { Disposable } from '@opensumi/ide-core-common';
import { IDisposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import { IDimension } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/dimension';
import { IRange, Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { Selection, ISelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/selection';
import {
  IEditorAction,
  IEditorViewState,
  ScrollType,
  IEditorModel,
  IEditorDecorationsCollection,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import {
  IModelDeltaDecoration,
  IModelDecorationsChangeAccessor,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

import { ICodeEditor, IPosition, Position } from '../../../src';
import { IEditorOptions } from '../../../lib/browser/monaco-api/editor';

let MERGE_EDITOR_ID = 0;

export class MockedMergeEditor extends Disposable implements IMergeEditorEditor {
  private readonly _id: number;

  constructor(public dom, public options, public override) {
    super();

    this._id = ++MERGE_EDITOR_ID;

    this.layout();
  }

  getOursEditor(): ICodeEditor {
    throw new Error('Method not implemented.');
  }
  getResultEditor(): ICodeEditor {
    throw new Error('Method not implemented.');
  }
  getTheirsEditor(): ICodeEditor {
    throw new Error('Method not implemented.');
  }
  open(openMergeEditorArgs: IOpenMergeEditorArgs): Promise<void> {
    throw new Error('Method not implemented.');
  }
  onDidDispose(listener: () => void): IDisposable {
    throw new Error('Method not implemented.');
  }
  getId(): string {
    throw new Error('Method not implemented.');
  }
  getEditorType(): string {
    throw new Error('Method not implemented.');
  }
  updateOptions(newOptions: IEditorOptions): void {
    throw new Error('Method not implemented.');
  }
  onVisible(): void {
    throw new Error('Method not implemented.');
  }
  onHide(): void {
    throw new Error('Method not implemented.');
  }
  layout(dimension?: IDimension | undefined): void {
    throw new Error('Method not implemented.');
  }
  focus(): void {
    throw new Error('Method not implemented.');
  }
  hasTextFocus(): boolean {
    throw new Error('Method not implemented.');
  }
  getSupportedActions(): IEditorAction[] {
    throw new Error('Method not implemented.');
  }
  saveViewState(): IEditorViewState | null {
    throw new Error('Method not implemented.');
  }
  restoreViewState(state: IEditorViewState | null): void {
    throw new Error('Method not implemented.');
  }
  getVisibleColumnFromPosition(position: IPosition): number {
    throw new Error('Method not implemented.');
  }
  getStatusbarColumn(position: IPosition): number {
    throw new Error('Method not implemented.');
  }
  getPosition(): Position | null {
    throw new Error('Method not implemented.');
  }
  setPosition(position: IPosition, source?: string | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealLine(lineNumber: number, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealLineInCenter(lineNumber: number, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealLineInCenterIfOutsideViewport(lineNumber: number, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealLineNearTop(lineNumber: number, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealPosition(position: IPosition, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealPositionInCenter(position: IPosition, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealPositionInCenterIfOutsideViewport(position: IPosition, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealPositionNearTop(position: IPosition, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  getSelection(): Selection | null {
    throw new Error('Method not implemented.');
  }
  getSelections(): Selection[] | null {
    throw new Error('Method not implemented.');
  }
  setSelection(selection: any) {
    throw new Error('Method not implemented.');
  }
  setSelections(selections: readonly ISelection[], source?: string | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealLines(startLineNumber: number, endLineNumber: number, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealLinesInCenter(lineNumber: number, endLineNumber: number, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealLinesInCenterIfOutsideViewport(
    lineNumber: number,
    endLineNumber: number,
    scrollType?: ScrollType | undefined,
  ): void {
    throw new Error('Method not implemented.');
  }
  revealLinesNearTop(lineNumber: number, endLineNumber: number, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealRange(range: IRange, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealRangeInCenter(range: IRange, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealRangeAtTop(range: IRange, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealRangeInCenterIfOutsideViewport(range: IRange, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealRangeNearTop(range: IRange, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  revealRangeNearTopIfOutsideViewport(range: IRange, scrollType?: ScrollType | undefined): void {
    throw new Error('Method not implemented.');
  }
  trigger(source: string | null | undefined, handlerId: string, payload: any): void {
    throw new Error('Method not implemented.');
  }
  getModel(): IEditorModel | null {
    throw new Error('Method not implemented.');
  }
  setModel(model: IEditorModel | null): void {
    throw new Error('Method not implemented.');
  }
  createDecorationsCollection(decorations?: IModelDeltaDecoration[] | undefined): IEditorDecorationsCollection {
    throw new Error('Method not implemented.');
  }
  changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any) {
    throw new Error('Method not implemented.');
  }
}
