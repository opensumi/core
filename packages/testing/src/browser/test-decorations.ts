import { Color, RGBA, themeColorFromId } from '@opensumi/ide-theme';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';
import { maxPriority } from './../common/testingStates';
import { labelForTestInState, testMessageSeverityColors } from './../common/constants';
import { ICodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { TestResultImpl, TestResultServiceToken } from './../common/test-result';
import { ResultChangeEvent, TestResultServiceImpl } from './test.result.service';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import * as editorCommon from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import { Disposable, IDisposable, IRange, URI, uuid } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { TestServiceToken } from '../common';
import { IModelDeltaDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { Event, MonacoOverrideServiceRegistry, ServiceNames } from '@opensumi/ide-core-browser';
import {
  IncrementalTestCollectionItem,
  InternalTestItem,
  IRichLocation,
  ITestMessage,
  TestMessageType,
  TestResultItem,
  TestResultState,
  TestRunProfileBitset,
  TestsDiff,
} from '../common/testCollection';
import {
  defaultIconColor,
  testingRunAllIcon,
  testingRunIcon,
  testingStatesToIcons,
  testStatesToIconColors,
} from './icons/icons';
import { TestServiceImpl } from './test.service';
import { removeAnsiEscapeCodes } from '@opensumi/ide-core-common';
import { MonacoCodeService } from '@opensumi/ide-editor/lib/browser/editor.override';
import { buildTestUri, TestUriType } from '../common/testingUri';

interface ITestDecoration extends IDisposable {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
  click(e: monaco.editor.IEditorMouseEvent): boolean;
}

const FONT_FAMILY_VAR = '--testMessageDecorationFontFamily';

const hasValidLocation = <T extends { location?: IRichLocation }>(
  editorUri: URI,
  t: T,
): t is T & { location: IRichLocation } => t.location?.uri.toString() === editorUri.toString();

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

  const iconColor = computedState === TestResultState.Unset ? defaultIconColor : testStatesToIconColors[computedState];

  // const hoverMessage = hoverMessageParts.join(', ');
  if (testIdWithMessages) {
    // const args = encodeURIComponent(JSON.stringify([testIdWithMessages]));
    // 这里应该使用 markdown 语法解析 command 命令给 hoverMessage 字段
    // e.g (command:vscode.peekTestError?${args})
  }

  /**
   * testing-run-glyph 这个样式类名是关键字段，不要随意改动
   * 主要是用来防止与 debug 断点的事件冲突（例: hover、mousedown）
   */
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
    if (e.target.position?.lineNumber !== this.line || e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN) {
      return false;
    }

    if (e.event.rightButton) {
      this.showContextMenu(e);
      return true;
    }

    this.defaultRun();

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
  @Autowired(TestServiceToken)
  private readonly testService: TestServiceImpl;

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
    return this.testService.runTests({
      tests: this.tests.map(({ test }) => test),
      group: TestRunProfileBitset.Run,
    });
  }

  protected override defaultDebug() {
    throw new Error('Method not implemented.');
  }
}

@Injectable({ multiple: true })
class RunSingleTestDecoration extends RunTestDecoration implements ITestDecoration {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(TestServiceToken)
  private readonly testService: TestServiceImpl;

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
    return this.testService.runTests({
      tests: [this.test],
      group: TestRunProfileBitset.Run,
    });
  }

  protected override defaultDebug() {
    throw new Error('Method not implemented.');
  }
}

@Injectable({ multiple: true })
class TestMessageDecoration implements ITestDecoration {
  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServicesRegistry: MonacoOverrideServiceRegistry;

  public id = '';

  public readonly editorDecoration: IModelDeltaDecoration;
  private readonly decorationId = `testmessage-${uuid()}`;
  private codeEditorService: MonacoCodeService;

  constructor(
    public readonly testMessage: ITestMessage,
    private readonly messageUri: URI | undefined,
    public readonly location: IRichLocation,
    private readonly editor: ICodeEditor,
  ) {
    this.codeEditorService = this.overrideServicesRegistry.getRegisteredService(
      ServiceNames.CODE_EDITOR_SERVICE,
    ) as MonacoCodeService;

    const severity = testMessage.type;
    const message =
      typeof testMessage.message === 'string' ? removeAnsiEscapeCodes(testMessage.message) : testMessage.message.value;
    this.codeEditorService.registerDecorationType(
      'test-message-decoration',
      this.decorationId,
      {
        after: {
          contentText: message,
          color: `${testMessageSeverityColors[severity]}`,
          fontSize: `${editor.getOption(EditorOption.fontSize)}px`,
          fontFamily: `var(${FONT_FAMILY_VAR})`,
          padding: '0px 12px 0px 24px',
        },
      },
      undefined,
      editor,
    );

    const options = this.codeEditorService.resolveDecorationOptions(this.decorationId, true);
    options.hoverMessage = typeof message === 'string' ? new MarkdownString().appendText(message) : message;
    options.afterContentClassName = `${options.afterContentClassName} testing-inline-message-content`;
    options.zIndex = 10;
    options.className = `testing-inline-message-margin testing-inline-message-severity-${severity}`;
    options.isWholeLine = true;
    options.stickiness = monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
    options.collapseOnReplaceEdit = true;

    this.editorDecoration = { range: firstLineRange(location.range), options };
  }

  click(e: monaco.editor.IEditorMouseEvent): boolean {
    if (e.event.rightButton) {
      return false;
    }

    if (!this.messageUri) {
      return false;
    }

    // 这里要实现点击后弹出 output peek widget

    return false;
  }

  dispose(): void {
    this.codeEditorService.removeDecorationType(this.decorationId);
  }
}

@Injectable({ multiple: true })
export class TestDecorationsContribution implements IEditorFeatureContribution {
  @Autowired(TestServiceToken)
  private readonly testService: TestServiceImpl;

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public get currentUri(): URI | null {
    return this.editor.currentUri;
  }

  private readonly disposer: Disposable = new Disposable();
  private invalidatedMessages = new WeakSet<ITestMessage>();

  private lastDecorations: ITestDecoration[] = [];

  constructor(@Optional() private readonly editor: IEditor) {}

  public contribute(): IDisposable {
    this.setDecorations(this.currentUri);

    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeModel((e: editorCommon.IModelChangedEvent) => {
        this.setDecorations((e.newModelUrl as unknown as URI) || undefined);
      }),
    );

    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeModelContent((e) => {
        if (!this.currentUri) {
          return;
        }

        let update = false;
        for (const change of e.changes) {
          for (const deco of this.lastDecorations) {
            if (
              deco instanceof TestMessageDecoration &&
              deco.location.range.startLineNumber >= change.range.startLineNumber &&
              deco.location.range.endLineNumber <= change.range.endLineNumber
            ) {
              this.invalidatedMessages.add(deco.testMessage);
              update = true;
            }
          }
        }

        if (update) {
          this.setDecorations(this.currentUri);
        }
      }),
    );

    this.disposer.addDispose(
      this.editor.monacoEditor.onMouseDown((e) => {
        for (const decoration of this.lastDecorations) {
          if (decoration.click(e)) {
            e.event.stopPropagation();
            return;
          }
        }
      }),
    );

    this.disposer.addDispose(
      this.testResultService.onTestChanged(({ item: result }) => {
        if (this.currentUri && result.item.uri && result.item.uri.toString() === this.currentUri.toString()) {
          this.setDecorations(this.currentUri);
        }
      }),
    );

    this.disposer.addDispose(
      Event.any<TestsDiff | ResultChangeEvent>(
        this.testResultService.onResultsChanged,
        this.testService.onDidProcessDiff,
      )(() => this.setDecorations(this.currentUri)),
    );

    return this.disposer;
  }

  private setDecorations(uri: URI | undefined | null): void {
    if (!uri) {
      this.clearDecorations();
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

      const lastResult = this.testResultService.results[0];
      if (lastResult instanceof TestResultImpl) {
        // task.otherMessages 的情况还未处理

        for (const test of lastResult.tests) {
          for (let taskId = 0; taskId < test.tasks.length; taskId++) {
            const state = test.tasks[taskId];
            for (let i = 0; i < state.messages.length; i++) {
              const m = state.messages[i];
              if (!this.invalidatedMessages.has(m) && hasValidLocation(uri, m)) {
                const uri =
                  m.type === TestMessageType.Info
                    ? undefined
                    : buildTestUri({
                        type: TestUriType.ResultActualOutput,
                        messageIndex: i,
                        taskIndex: taskId,
                        resultId: lastResult.id,
                        testExtId: test.item.extId,
                      });

                newDecorations.push(
                  this.injector.get(TestMessageDecoration, [m, uri, m.location, this.editor.monacoEditor]),
                );
              }
            }
          }
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

  private clearDecorations(): void {
    if (!this.lastDecorations.length) {
      return;
    }

    this.editor.monacoEditor.changeDecorations((accessor) => {
      for (const decoration of this.lastDecorations) {
        accessor.removeDecoration(decoration.id);
      }

      this.lastDecorations = [];
    });
  }
}
