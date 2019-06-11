import { Injectable, ConstructorOf, Provider } from '@ali/common-di';
import { Event } from '@ali/ide-core-common';

export abstract class MonacoService  {
  public abstract onMonacoLoaded: Event<boolean>;

  public abstract async createCodeEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IEditorConstructionOptions,
  ): Promise<monaco.editor.IStandaloneCodeEditor>;

  public abstract async loadMonaco(): Promise<void>;

  public abstract async createDiffEditor(monacoContainer: HTMLElement,
                                         options?: monaco.editor.IDiffEditorConstructionOptions): Promise<monaco.editor.IDiffEditor>;

}

export function createMonacoServiceProvider<T extends MonacoService>(cls: ConstructorOf<T>): Provider {
  return {
    token: MonacoService,
    useClass: cls,
  };
}
