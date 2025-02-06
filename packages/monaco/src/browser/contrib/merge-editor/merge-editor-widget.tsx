import React from 'react';
import ReactDOM from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, ConfigProvider } from '@opensumi/ide-core-browser';
import { IMergeEditorEditor, IOpenMergeEditorArgs } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { Disposable, IRange, ISelection, URI } from '@opensumi/ide-core-common';
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
import { EditorViewType, IMergeEditorViewState } from './types';
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
  @Autowired(AppConfig)
  private readonly configContext: AppConfig;

  @Autowired(MergeEditorService)
  private readonly mergeEditorService: MergeEditorService;

  private readonly _id: number;
  private readonly viewStateMap: Map<string, IMergeEditorViewState> = new Map();
  private outputUri: URI | undefined;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: IMergeEditorEditorConstructionOptions,
    overrides: { [key in string]: any },
  ) {
    super();

    this._id = ++MERGE_EDITOR_ID;

    this.layout();

    this.addDispose(
      this.mergeEditorService.onRestoreState((uri) => {
        if (uri) {
          const key = uri.toString();
          this.viewStateMap.delete(key);
          this.outputUri = undefined;

          /**
           * 重置回原来的文档内容
           */
          const nutrition = this.mergeEditorService.getNutrition();
          if (nutrition) {
            const { ancestor } = nutrition;
            const { baseContent, textModel } = ancestor!;
            (textModel as ITextModel).setValue(baseContent);

            // 取出 result editor 的 model, 重置回原来的文档内容
            const resultModel = this.getResultEditor().getModel();
            if (resultModel) {
              (resultModel as ITextModel).setValue(baseContent);
            }
          }
        }
      }),
    );
  }
  getSelection(): Selection | null {
    return null;
  }
  getSelections(): Selection[] | null {
    return null;
  }

  async open(args: IOpenMergeEditorArgs): Promise<void> {
    const { ancestor, input1, input2, output } = args;
    this.mergeEditorService.setNutritionAndLaunch(args);

    // 保存上一个 uri 的状态
    this.saveViewState(this.outputUri);

    this.outputUri = output.uri;
    const uniqueKey = this.outputUri.toString();

    this.setModel({
      ours: input1.textModel as ITextModel,
      result: ancestor.textModel as ITextModel,
      theirs: input2.textModel as ITextModel,
    });

    if (this.viewStateMap.has(uniqueKey)) {
      const state = this.viewStateMap.get(uniqueKey)!;
      this.restoreViewState(state);
      const { turnLeft, turnRight } = state;
      await this.mergeEditorService.compare(turnLeft, turnRight);
    } else {
      await this.mergeEditorService.compare();
    }

    this.updateOptions(this.options);
    return Promise.resolve();
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
    return this.onDispose(listener);
  }

  getId(): string {
    return this.getEditorType() + ':' + this._id;
  }

  getEditorType(): string {
    return 'MERGE_EDITOR_DIFF';
  }

  updateOptions(newOptions: IEditorOptions): void {
    this.mergeEditorService.updateOptions(newOptions);
  }

  onVisible(): void {}

  onHide(): void {}

  layout(dimension?: IDimension): void {
    ReactDOM.createRoot(this.container).render(
      <ConfigProvider value={this.configContext}>
        <Grid />
      </ConfigProvider>,
    );
  }

  focus(): void {}

  hasTextFocus(): boolean {
    return false;
  }

  getSupportedActions(): IEditorAction[] {
    return [];
  }

  saveViewState(uri?: URI): IEditorViewState | null {
    if (!uri) {
      return null;
    }

    const key = uri.toString();
    this.viewStateMap.set(key, {
      [EditorViewType.CURRENT]: this.getOursEditor().saveViewState(),
      [EditorViewType.RESULT]: this.getResultEditor().saveViewState(),
      [EditorViewType.INCOMING]: this.getTheirsEditor().saveViewState(),
      turnLeft: this.mergeEditorService.getTurnLeftRangeMapping(),
      turnRight: this.mergeEditorService.getTurnRightRangeMapping(),
    });
    return null;
  }

  restoreViewState(state: IMergeEditorViewState | IEditorViewState | null): void {
    const {
      [EditorViewType.CURRENT]: current,
      [EditorViewType.RESULT]: result,
      [EditorViewType.INCOMING]: incoming,
    } = state as IMergeEditorViewState;

    this.getOursEditor().restoreViewState(current);
    this.getResultEditor().restoreViewState(result);
    this.getTheirsEditor().restoreViewState(incoming);
  }

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
