import { Injectable, Optional, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { EDITOR_COMMANDS, IContextKeyService, Schemas } from '@opensumi/ide-core-browser';
import { CommandService, Disposable, IDisposable, MutableDisposable, URI } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import * as editorCommon from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

import { ITestResult, TestResultServiceToken } from '../../common/test-result';
import { IRichLocation, ITestItem, ITestMessage, TestMessageType, TestResultItem } from '../../common/testCollection';
import { TestingPeekOpenerServiceToken } from '../../common/testingPeekOpener';
import { isDiffable } from '../../common/testingStates';
import { TestContextKey } from '../test-contextkey.service';
import { TestResultServiceImpl } from '../test.result.service';

import { buildTestUri, TestUriType } from './../../common/testingUri';
import { TestingPeekOpenerServiceImpl } from './test-peek-opener.service';
import { TestingOutputPeek } from './test-peek-widget';

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

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  private readonly testContextKey: TestContextKey;

  private readonly disposer: Disposable = new Disposable();

  private readonly peekView = new MutableDisposable<TestingOutputPeek>();

  private currentPeekUri: URI | undefined;

  constructor(@Optional() private readonly editor: IEditor) {
    this.testContextKey = this.injector.get(TestContextKey, [(this.editor.monacoEditor as any)._contextKeyService]);
  }

  private allMessages(results: readonly ITestResult[]): {
    result: ITestResult;
    test: TestResultItem;
    taskIndex: number;
    messageIndex: number;
  }[] {
    const messages: {
      result: ITestResult;
      test: TestResultItem;
      taskIndex: number;
      messageIndex: number;
    }[] = [];

    for (const result of results) {
      for (const test of result.tests) {
        for (let taskIndex = 0; taskIndex < test.tasks.length; taskIndex++) {
          for (let messageIndex = 0; messageIndex < test.tasks[taskIndex].messages.length; messageIndex++) {
            messages.push({ result, test, taskIndex, messageIndex });
          }
        }
      }
    }

    return messages;
  }

  public contribute(): IDisposable {
    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeModel((e: editorCommon.IModelChangedEvent) => {
        if (e.newModelUrl?.scheme !== Schemas.file) {
          return;
        }

        this.testingPeekOpenerService.setPeekContrib(e.newModelUrl as unknown as URI, this);
      }),
    );

    this.disposer.addDispose(
      Disposable.create(() => {
        if (this.editor.currentUri) {
          this.testingPeekOpenerService.delPeekContrib(this.editor.currentUri);
        }
      }),
    );
    return this.disposer;
  }

  public toggle(uri: URI) {
    if (this.currentPeekUri?.toString() === uri.toString()) {
      this.peekView.clear();
    } else {
      this.show(uri);
    }
  }

  public openCurrentInEditor() {
    const current = this.peekView.value?.current;
    if (!current) {
      return;
    }

    if (current.isDiffable) {
      this.commandService.executeCommand(
        EDITOR_COMMANDS.API_OPEN_DIFF_EDITOR_COMMAND_ID,
        current.expectedUri,
        current.actualUri,
        'Expected <-> Actual',
      );
    } else {
      this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, current.messageUri, {
        preview: false,
        focus: true,
      });
    }
  }

  public removePeek() {
    this.peekView.value?.hide();
    this.peekView.clear();
  }

  public async show(uri: URI): Promise<void> {
    const dto = this.testResultService.retrieveTest(uri);
    if (!dto) {
      return;
    }

    if (!this.peekView.value) {
      this.peekView.value = this.injector.get(TestingOutputPeek, [this.editor.monacoEditor, this.contextKeyService]);
      this.disposer.addDispose(
        this.peekView.value.onDidClose(() => {
          this.testContextKey.contextTestingIsPeekVisible.set(false);
          this.currentPeekUri = undefined;
          this.peekView.value = undefined;
        }),
      );

      this.testContextKey.contextTestingIsPeekVisible.set(true);
      this.peekView.value.create();
    }

    this.peekView.value.setModel(dto);
    this.currentPeekUri = uri;
  }

  public async openAndShow(uri: URI) {
    const dto = this.testResultService.retrieveTest(uri);
    if (!dto) {
      return;
    }

    if (!dto.revealLocation || dto.revealLocation.uri.toString() === this.editor.currentUri?.toString()) {
      return this.show(uri);
    }

    const ctor = this.testingPeekOpenerService.peekControllerMap.get(uri.toString());

    if (!ctor) {
      return;
    }

    this.removePeek();

    await this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, URI.parse(uri.toString()), {
      preview: true,
      focus: true,
    });

    ctor.show(uri);
  }

  public next() {
    const dto = this.peekView.value?.current;
    if (!dto) {
      return;
    }

    let found = false;
    const getAllMessage = this.allMessages(this.testResultService.results);

    for (const { messageIndex, taskIndex, result, test } of getAllMessage) {
      if (found) {
        this.openAndShow(
          buildTestUri({
            type: TestUriType.ResultMessage,
            messageIndex,
            taskIndex,
            resultId: result.id,
            testExtId: test.item.extId,
          }),
        );
        return;
      } else if (
        dto.test.extId === test.item.extId &&
        dto.messageIndex === messageIndex &&
        dto.taskIndex === taskIndex &&
        dto.resultId === result.id
      ) {
        found = true;
      }
    }
  }

  public previous() {
    const dto = this.peekView.value?.current;
    if (!dto) {
      return;
    }

    let previous: { messageIndex: number; taskIndex: number; result: ITestResult; test: TestResultItem } | undefined;

    const getAllMessage = this.allMessages(this.testResultService.results);

    for (const m of getAllMessage) {
      if (
        dto.test.extId === m.test.item.extId &&
        dto.messageIndex === m.messageIndex &&
        dto.taskIndex === m.taskIndex &&
        dto.resultId === m.result.id
      ) {
        if (!previous) {
          return;
        }

        this.openAndShow(
          buildTestUri({
            type: TestUriType.ResultMessage,
            messageIndex: previous.messageIndex,
            taskIndex: previous.taskIndex,
            resultId: previous.result.id,
            testExtId: previous.test.item.extId,
          }),
        );
        return;
      }

      previous = m;
    }
  }
}
