import * as editorCommon from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { buildTestUri, parseTestUri, TestUriType } from './../../common/testingUri';
import { Injectable, Optional, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Disposable, IDisposable, MutableDisposable, URI } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import {
  IRichLocation,
  ITestErrorMessage,
  ITestItem,
  ITestMessage,
  TestMessageType,
  TestResultItem,
} from '../../common/testCollection';
import { TestingOutputPeek } from './test-peek-widget';
import { TestResultServiceImpl } from '../test.result.service';
import { TestResultServiceToken } from '../../common/test-result';
import { TestingPeekOpenerServiceToken } from '../../common/testingPeekOpener';
import { TestingPeekOpenerServiceImpl } from './test-peek-opener.service';

const isDiffable = (
  message: ITestErrorMessage,
): message is ITestErrorMessage & { actualOutput: string; expectedOutput: string } =>
  message.actual !== undefined && message.expected !== undefined;
export class TestDto {
  public readonly test: ITestItem;
  public readonly messages: ITestMessage[];
  public readonly expectedUri: URI;
  public readonly actualUri: URI;
  public readonly messageUri: URI;
  public readonly revealLocation: IRichLocation | undefined;

  public get isDiffable() {
    const message = this.messages[this.messageIndex];
    return message.type === TestMessageType.Error && isDiffable(message);
  }

  constructor(
    public readonly resultId: string,
    test: TestResultItem,
    public readonly taskIndex: number,
    public readonly messageIndex: number,
  ) {
    this.test = test.item;
    this.messages = test.tasks[taskIndex].messages;
    this.messageIndex = messageIndex;

    const parts = { messageIndex, resultId, taskIndex, testExtId: test.item.extId };
    this.expectedUri = buildTestUri({ ...parts, type: TestUriType.ResultExpectedOutput });
    this.actualUri = buildTestUri({ ...parts, type: TestUriType.ResultActualOutput });
    this.messageUri = buildTestUri({ ...parts, type: TestUriType.ResultMessage });

    const message = this.messages[this.messageIndex];
    this.revealLocation =
      message.location ??
      (test.item.uri && test.item.range ? { uri: test.item.uri, range: Range.lift(test.item.range) } : undefined);
  }
}

@Injectable({ multiple: true })
export class TestOutputPeekContribution implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  @Autowired(TestingPeekOpenerServiceToken)
  private readonly testingPeekOpenerService: TestingPeekOpenerServiceImpl;

  private readonly disposer: Disposable = new Disposable();

  private readonly peekView = new MutableDisposable<TestingOutputPeek>();

  constructor(@Optional() private readonly editor: IEditor) {}

  private retrieveTest(uri: URI): TestDto | undefined {
    const parts = parseTestUri(uri);
    if (!parts) {
      return undefined;
    }

    const { resultId, testExtId, taskIndex, messageIndex } = parts;
    const test = this.testResultService.getResult(parts.resultId)?.getStateById(testExtId);
    if (!test || !test.tasks[parts.taskIndex]) {
      return;
    }

    return new TestDto(resultId, test, taskIndex, messageIndex);
  }

  public contribute(): IDisposable {
    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeModel((e: editorCommon.IModelChangedEvent) => {
        this.testingPeekOpenerService.setPeekContrib(e.newModelUrl as unknown as URI, this);
      }),
    );
    return this.disposer;
  }

  public async show(uri: URI): Promise<void> {
    const dto = this.retrieveTest(uri);
    if (!dto) {
      return;
    }

    if (!this.peekView.value) {
      this.peekView.value = this.injector.get(TestingOutputPeek, [this.editor.monacoEditor]);
    }

    this.peekView.value.setModel(dto);
  }
}
