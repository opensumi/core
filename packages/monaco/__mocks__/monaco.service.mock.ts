import { Injectable } from '@opensumi/di';
import { IMergeEditorEditor } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { IDiffEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

import { MonacoService, ServiceNames } from '../src/common';

import { createMockedMonaco } from './monaco';

@Injectable()
export class MockedMonacoService implements MonacoService {
  private mockedMonaco = createMockedMonaco();

  constructor() {
    (global as any).monaco = this.mockedMonaco;
  }
  public createMergeEditor(
    monacoContainer: HTMLElement,
    options?: IDiffEditorConstructionOptions | undefined,
    overrides?: { [key: string]: any } | undefined,
  ): IMergeEditorEditor {
    return this.mockedMonaco.editor.createMergeEditor(monacoContainer, options);
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
