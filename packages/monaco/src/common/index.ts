import { Injectable, ConstructorOf, Provider } from '@ali/common-di';

export class CommonCls {
  add(a: number, b: number) {
    return a + b;
  }
}


@Injectable()
export abstract class MonacoService  {
  
  abstract async createCodeEditor(monacoContainer: HTMLElement, options?: monaco.editor.IEditorConstructionOptions): Promise<monaco.editor.IStandaloneCodeEditor>;

}

export function createMonacoServiceProvider<T extends MonacoService>(cls: ConstructorOf<T>): Provider {
  return {
    token: MonacoService,
    useClass: cls,
  };
}