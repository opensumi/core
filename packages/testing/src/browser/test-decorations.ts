import { maxPriority } from './../common/testingStates';
import { labelForTestInState } from './../common/constants';
import { ICodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { TestResultServiceToken } from './../common/test-result';
import { TestResultServiceImpl } from './test.result.service';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import * as editorCommon from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import { Disposable, IDisposable, IRange, URI } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { ITestService, TestServiceToken } from '../common';
import { IModelDeltaDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import {
  IncrementalTestCollectionItem,
  InternalTestItem,
  TestResultItem,
  TestResultState,
} from '../common/testCollection';
import {
  defaultIconColor,
  testingRunAllIcon,
  testingRunIcon,
  testingStatesToIcons,
  testStatesToIconColors,
} from './icons/icons';

interface ITestDecoration extends IDisposable {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
  click(e: monaco.editor.IEditorMouseEvent): boolean;
}

const firstLineRange = (originalRange: IRange) => ({
  startLineNumber: originalRange.startLineNumber,
  endLineNumber: originalRange.startLineNumber,
  startColumn: 0,
  endColumn: 1,
});

const createRunTestDecoration = (
  tests: readonly IncrementalTestCollectionItem[],
  states: readonly (TestResultItem | undefined)[],
): IModelDeltaDecoration => {
  const range = tests[0]?.item.range;
  if (!range) {
    throw new Error('Test decorations can only be created for tests with a range');
  }

  let computedState = TestResultState.Unset;
  let hoverMessageParts: string[] = [];
  let testIdWithMessages: string | undefined;
  let retired = false;
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const resultItem = states[i];
    const state = resultItem?.computedState ?? TestResultState.Unset;
    hoverMessageParts.push(labelForTestInState(test.item.label, state));
    computedState = maxPriority(computedState, state);
    retired = retired || !!resultItem?.retired;
    if (!testIdWithMessages && resultItem?.tasks.some((t) => t.messages.length)) {
      testIdWithMessages = test.item.extId;
    }
  }

  const hasMultipleTests = tests.length > 1 || tests[0].children.size > 0;
  const icon =
    computedState === TestResultState.Unset
      ? hasMultipleTests
        ? testingRunAllIcon
        : testingRunIcon
      : testingStatesToIcons.get(computedState)!;

  const iconColor = testStatesToIconColors[icon] || defaultIconColor;

  const hoverMessage = hoverMessageParts.join(', ');
  if (testIdWithMessages) {
    const args = encodeURIComponent(JSON.stringify([testIdWithMessages]));
    // 这里应该使用 markdown 语法解析 command 命令给 hoverMessage 字段
    // e.g (command:vscode.peekTestError?${args})
  }

  let glyphMarginClassName = `${icon} ${iconColor} testing-run-glyph`;
  if (retired) {
    glyphMarginClassName += ' retired';
  }

  return {
    range: firstLineRange(range),
    options: {
      description: 'run-test-decoration',
      isWholeLine: true,
      glyphMarginClassName,
      stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    },
  };
};

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
  protected abstract getContextMenuActions(e: monaco.editor.IEditorMouseEvent): void;

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

class MultiRunTestDecoration extends RunTestDecoration implements ITestDecoration {
  constructor(
    private readonly tests: {
      test: IncrementalTestCollectionItem;
      resultItem: TestResultItem | undefined;
    }[],
    editor: ICodeEditor,
  ) {
    super(
      createRunTestDecoration(
        tests.map((t) => t.test),
        tests.map((t) => t.resultItem),
      ),
      editor,
    );
  }

  public override merge(
    test: IncrementalTestCollectionItem,
    resultItem: TestResultItem | undefined,
  ): RunTestDecoration {
    this.tests.push({ test, resultItem });
    this.editorDecoration = createRunTestDecoration(
      this.tests.map((t) => t.test),
      this.tests.map((t) => t.resultItem),
    );
    return this;
  }

  protected override getContextMenuActions() {
    throw new Error('Method not implemented.');
  }

  protected override defaultRun() {
    throw new Error('Method not implemented.');
  }

  protected override defaultDebug() {
    throw new Error('Method not implemented.');
  }
}

@Injectable({ multiple: true })
class RunSingleTestDecoration extends RunTestDecoration implements ITestDecoration {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  constructor(
    private readonly test: IncrementalTestCollectionItem,
    editor: ICodeEditor,
    private readonly resultItem: TestResultItem | undefined,
  ) {
    super(createRunTestDecoration([test], [resultItem]), editor);
  }

  public override merge(
    test: IncrementalTestCollectionItem,
    resultItem: TestResultItem | undefined,
  ): RunTestDecoration {
    return this.injector.get(MultiRunTestDecoration, [
      [
        { test: this.test, resultItem: this.resultItem },
        { test, resultItem },
      ],
      this.editor,
    ]);
  }

  protected override getContextMenuActions(e: monaco.editor.IEditorMouseEvent) {
    return this.getTestContextMenuActions(this.test, this.resultItem);
  }

  protected override defaultRun() {
    throw new Error('Method not implemented.');
  }

  protected override defaultDebug() {
    throw new Error('Method not implemented.');
  }
}

@Injectable({ multiple: true })
export class TestDecorationsContribution implements IEditorFeatureContribution {
  @Autowired(TestServiceToken)
  private readonly testService: ITestService;

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private currentUri?: URI;
  private readonly disposer: Disposable = new Disposable();
  private lastDecorations: ITestDecoration[] = [];

  constructor(@Optional() private readonly editor: IEditor) {
    this.currentUri = editor.currentUri!;
  }

  public contribute(): IDisposable {
    this.setDecorations(this.currentUri);

    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeModel((e: editorCommon.IModelChangedEvent) => {
        this.setDecorations((e.newModelUrl as unknown as URI) || undefined);
      }),
    );

    return this.disposer;
  }

  private setDecorations(uri: URI | undefined | null): void {
    if (!uri || !this.editor) {
      return;
    }

    this.editor.monacoEditor.changeDecorations((accessor) => {
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
          newDecorations.push(
            this.injector.get(RunSingleTestDecoration, [test, this.editor!.monacoEditor, stateLookup?.[1]]),
          );
        }
      }

      accessor
        .deltaDecorations(
          this.lastDecorations.map((d) => d.id),
          newDecorations.map((d) => d.editorDecoration),
        )
        .forEach((id, i) => (newDecorations[i].id = id));
      this.lastDecorations = newDecorations;
    });
  }
}
