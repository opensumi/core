import { Injectable, ConstructorOf, Provider } from '@ali/common-di';

@Injectable()
export abstract class MonacoService  {
  
  public abstract async createCodeEditor(monacoContainer: HTMLElement, options?: monaco.editor.IEditorConstructionOptions): Promise<monaco.editor.IStandaloneCodeEditor>;

  public abstract async loadMonaco(): Promise<void>;
}

export function createMonacoServiceProvider<T extends MonacoService>(cls: ConstructorOf<T>): Provider {
  return {
    token: MonacoService,
    useClass: cls,
  };
}