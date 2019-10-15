import { Event, IJSONSchema } from '..';

export enum ServiceNames {
  CODE_EDITOR_SERVICE = 'codeEditorService',
  TEXT_MODEL_SERVICE = 'textModelService',
  CONTEXT_VIEW_SERVICE = 'contextViewService',
  COMMAND_SERVICE = 'commandService',
  CONTEXT_KEY_SERVICE = 'contextKeyService',
  BULK_EDIT_SERVICE = 'IWorkspaceEditService',
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

export const Extensions = {
  JSONContribution: 'base.contributions.json',
};

export interface ISchemaContributions {
  schemas: { [id: string]: IJSONSchema };
}

export interface ISchemaRegistry {

  readonly onDidChangeSchema: Event<string>;

  registerSchema(uri: string, unresolvedSchemaContent: IJSONSchema, fileMatch: string[]): void;

  notifySchemaChanged(uri: string): void;

  getSchemaContributions(): ISchemaContributions;
}

export const ISchemaRegistry = Symbol('ISchemaRegistry');

export const JsonSchemaContribution = Symbol('JsonSchemaContribution');
export interface JsonSchemaContribution {
  registerSchema(registry: ISchemaRegistry): void;
}
export interface JsonSchemaConfiguration {
  url: string;
  fileMatch: string[];
}
export interface ISchemaStore {
  onSchemasChanged: Event<void>;
  register(config: JsonSchemaConfiguration): void;
  getConfigurations(): JsonSchemaConfiguration[];
}

export const ISchemaStore = Symbol('ISchemaStore');
