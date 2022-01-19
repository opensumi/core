import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { ITextEditorOptions } from '@opensumi/monaco-editor-core/esm/vs/platform/editor/common/editor';
import { ITestResult } from '../../common/test-result';
import { TestResultItem } from '../../common/testCollection';
import { ITestingPeekOpenerService } from '../../common/testingPeekOpener';

@Injectable()
export class TestingPeekOpenerServiceImpl extends Disposable implements ITestingPeekOpenerService {
  _serviceBrand: undefined;
  tryPeekFirstError(result: ITestResult, test: TestResultItem, options?: Partial<ITextEditorOptions>): boolean {
    throw new Error('Method not implemented.');
  }
  open(): void {
    throw new Error('Method not implemented.');
  }
  closeAllPeeks(): void {
    throw new Error('Method not implemented.');
  }
}
