import { Event } from '..';

export enum ServiceNames {
  CODE_EDITOR_SERVICE = 'codeEditorService',
  TEXT_MODEL_SERVICE = 'textModelService',
  CONTEXT_VIEW_SERVICE = 'contextViewService',
  COMMAND_SERVICE = 'commandService',
}

export abstract class MonacoService {
  public abstract onMonacoLoaded: Event<boolean>;

  public abstract async createCodeEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IEditorConstructionOptions,
  ): Promise<monaco.editor.IStandaloneCodeEditor>;

  public abstract async loadMonaco(): Promise<void>;

  public abstract async createDiffEditor(monacoContainer: HTMLElement,
                                         options?: monaco.editor.IDiffEditorConstructionOptions): Promise<monaco.editor.IDiffEditor>;

  public abstract registerOverride(serviceName: ServiceNames, service: any): void;
}

export const MonacoContribution = Symbol('MonacoContribution');

export interface MonacoContribution {
  onMonacoLoaded(monacoService: MonacoService);
}
