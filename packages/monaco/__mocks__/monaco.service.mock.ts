import { Injectable } from '@opensumi/di';
import { Deferred, Emitter } from '@opensumi/ide-core-common';

import { MonacoService, ServiceNames } from '../src/common';

import { createMockedMonaco } from './monaco';

@Injectable()
export class MockedMonacoService implements MonacoService {
  private mockedMonaco = createMockedMonaco();

  constructor() {
    (global as any).monaco = this.mockedMonaco;
  }

  public createCodeEditor(monacoContainer: HTMLElement, options) {
    return this.mockedMonaco.editor.create(monacoContainer, options);
  }
  public createDiffEditor(monacoContainer: HTMLElement, options) {
    return this.mockedMonaco.editor.createDiffEditor(monacoContainer, options);
  }
  public registerOverride(serviceName: ServiceNames, service: any): void {}
  public testTokenize(line: string, languageId: string) {}

  public getOverride(serviceName: ServiceNames) {}
}
