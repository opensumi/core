import { ICodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { TestResultServiceToken } from './../common/test-result';
import { TestResultServiceImpl } from './test.result.service';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import * as editorCommon from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, IAction, IDisposable, URI } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { ITestService, TestServiceToken } from '../common';
import { IModelDeltaDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IncrementalTestCollectionItem, InternalTestItem, TestResultItem } from '../common/testCollection';
import { IReference } from '@opensumi/ide-core-common/lib/lifecycle';

interface ITestDecoration extends IDisposable {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
  click(e: monaco.editor.IEditorMouseEvent): boolean;
}

abstract class RunTestDecoration extends Disposable {
  public id = '';

  public get line() {
    return this.editorDecoration.range.startLineNumber;
  }

  constructor(public editorDecoration: IModelDeltaDecoration, protected readonly editor: ICodeEditor) {
    super();
  }

  public click(e: monaco.editor.IEditorMouseEvent): boolean {
    return true;
  }

  /**
   * 添加测试到装饰器
   */
  public abstract merge(
    other: IncrementalTestCollectionItem,
    resultItem: TestResultItem | undefined,
  ): RunTestDecoration;

  /**
   * 装饰器右键菜单
   */
  protected abstract getContextMenuActions(e: monaco.editor.IEditorMouseEvent): IReference<IAction[]>;

  protected abstract defaultRun(): void;

  protected abstract defaultDebug(): void;

  private showContextMenu(e: monaco.editor.IEditorMouseEvent) {}

  private getGutterLabel() {}

  /**
   * 获取与单个测试相关的上下文菜单操作
   */
  protected getTestContextMenuActions(test: InternalTestItem, resultItem?: TestResultItem): void {}

  private getContributedTestActions(test: InternalTestItem, capabilities: number): void {}
}

@Injectable()
export class TestDecorationsContribution implements IEditorFeatureContribution {
  @Autowired(TestServiceToken)
  private readonly testService: ITestService;

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  private currentUri?: URI;
  private currentEditor?: IEditor;
  private readonly disposer: Disposable = new Disposable();

  public contribute(editor: IEditor): IDisposable {
    this.currentEditor = editor;
    this.currentUri = editor.currentUri!;
    this.setDecorations(this.currentUri);

    this.disposer.addDispose(
      this.currentEditor.monacoEditor.onDidChangeModel((e: editorCommon.IModelChangedEvent) => {
        this.setDecorations((e.newModelUrl as unknown as URI) || undefined);
      }),
    );

    return this.disposer;
  }

  private setDecorations(uri: URI | undefined | null): void {
    if (!uri || !this.currentEditor) {
      return;
    }

    this.currentEditor.monacoEditor.changeDecorations((accessor) => {
      console.log('this.testService', this.testService, accessor);
      const newDecorations: ITestDecoration[] = [];

      for (const test of this.testService.collection.all) {
        if (!test.item.range || test.item.uri?.toString() !== uri.toString()) {
          continue;
        }

        const stateLookup = this.testResultService.getStateById(test.item.extId);
        const line = test.item.range.startLineNumber;
        const resultItem = stateLookup?.[1];
        const existing = newDecorations.findIndex((d) => d instanceof RunTestDecoration && d.line === line);
        if (existing !== -1) {
          newDecorations[existing] = (newDecorations[existing] as RunTestDecoration).merge(test, resultItem);
        } else {
          // newDecorations.push(this.instantiationService.createInstance(RunSingleTestDecoration, test, this.editor, stateLookup?.[1]));
        }
      }
    });
  }
}
