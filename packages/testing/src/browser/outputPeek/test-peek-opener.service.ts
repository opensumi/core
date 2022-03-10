import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { ITextEditorOptions } from '@opensumi/monaco-editor-core/esm/vs/platform/editor/common/editor';

import { ITestResult, TestResultServiceToken } from '../../common/test-result';
import { ITestMessage, ITestTaskState, TestResultItem } from '../../common/testCollection';
import { ITestingPeekOpenerService } from '../../common/testingPeekOpener';
import { buildTestUri, ParsedTestUri, TestUriType } from '../../common/testingUri';
import { TestResultServiceImpl } from '../test.result.service';

import { TestOutputPeekContribution } from './test-output-peek';

type TestUriWithDocument = ParsedTestUri & { documentUri: URI };

const mapFindTestMessage = <T>(
  test: TestResultItem,
  fn: (task: ITestTaskState, message: ITestMessage, messageIndex: number, taskIndex: number) => T | undefined,
) => {
  for (let taskIndex = 0; taskIndex < test.tasks.length; taskIndex++) {
    const task = test.tasks[taskIndex];
    for (let messageIndex = 0; messageIndex < task.messages.length; messageIndex++) {
      const r = fn(task, task.messages[messageIndex], messageIndex, taskIndex);
      if (r !== undefined) {
        return r;
      }
    }
  }

  return undefined;
};

@Injectable()
export class TestingPeekOpenerServiceImpl extends Disposable implements ITestingPeekOpenerService {
  @Autowired(WorkbenchEditorService)
  private editorService: WorkbenchEditorService;

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  declare _serviceBrand: undefined;

  private lastUri?: TestUriWithDocument;

  public readonly peekControllerMap: Map<string, TestOutputPeekContribution> = new Map();

  public get currentUri(): URI | undefined {
    return this.editorService.currentEditor?.currentUri!;
  }

  private async showPeekFromUri(testUri: TestUriWithDocument, options?: ITextEditorOptions) {
    const editor = this.editorService.currentEditor;

    this.lastUri = testUri;

    const uri = buildTestUri(this.lastUri);
    const ctor = this.peekControllerMap.get(editor?.currentUri!.toString()!);
    ctor?.show(uri);

    return true;
  }

  private getAnyCandidateMessage() {
    const seen = new Set<string>();
    for (const result of this.testResultService.results) {
      for (const test of result.tests) {
        if (seen.has(test.item.extId)) {
          continue;
        }

        seen.add(test.item.extId);
        const found = mapFindTestMessage(
          test,
          (task, message, messageIndex, taskIndex) =>
            message.location && {
              type: TestUriType.ResultMessage,
              testExtId: test.item.extId,
              resultId: result.id,
              taskIndex,
              messageIndex,
              documentUri: message.location.uri,
            },
        );

        if (found) {
          return found;
        }
      }
    }

    return undefined;
  }

  public setPeekContrib(uri: URI, contrib: TestOutputPeekContribution): this {
    const uriStr = uri.toString();
    if (!this.peekControllerMap.has(uriStr)) {
      this.peekControllerMap.set(uriStr, contrib);
    }
    return this;
  }

  public delPeekContrib(uri: URI): this {
    const uriStr = uri.toString();
    this.peekControllerMap.delete(uriStr);
    return this;
  }

  public tryPeekFirstError(result: ITestResult, test: TestResultItem, options?: Partial<ITextEditorOptions>): boolean {
    throw new Error('Method not implemented.');
  }

  public async open(): Promise<boolean> {
    let uri: any;

    if (!uri) {
      uri = this.getAnyCandidateMessage();
    }

    if (!uri) {
      return false;
    }

    return this.showPeekFromUri(uri);
  }

  public closeAllPeeks(): void {
    for (const ctor of this.peekControllerMap.values()) {
      ctor.removePeek();
    }
  }
}
