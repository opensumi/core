import { Injectable } from '@opensumi/di';
import { Deferred, Emitter } from '@opensumi/ide-core-common';

import { MonacoService, ServiceNames } from '../src/common';

import { createMockedMonaco } from './monaco';

@Injectable()
export class MockedMonacoService implements MonacoService {
  private _onMonacoLoaded: Emitter<boolean> = new Emitter<boolean>();
  public onMonacoLoaded = this._onMonacoLoaded.event;
  private mockedMonaco = createMockedMonaco();

  private readonly _monacoLoaded = new Deferred<void>();
  get monacoLoaded(): Promise<void> {
    return this._monacoLoaded.promise;
  }

  constructor() {
    (global as any).monaco = this.mockedMonaco;
    setTimeout(() => {
      this._onMonacoLoaded.fire(true);
      this._monacoLoaded.resolve();
    });
  }

  public createCodeEditor(monacoContainer: HTMLElement, options) {
    return this.mockedMonaco.editor.create(monacoContainer, options);
  }
  public async loadMonaco(): Promise<void> {}
  public createDiffEditor(monacoContainer: HTMLElement, options) {
    return this.mockedMonaco.editor.createDiffEditor(monacoContainer, options);
  }
  public registerOverride(serviceName: ServiceNames, service: any): void {}
  public testTokenize(line: string, languageId: string) {}

  public getOverride(serviceName: ServiceNames) {}
}
