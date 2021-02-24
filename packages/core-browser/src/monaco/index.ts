import * as suggest from '@ali/monaco-editor-core/esm/vs/editor/contrib/suggest/suggestWidget';
import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { Event, IJSONSchema, IContextKeyService, IDisposable, BasicEvent } from '..';

export enum ServiceNames {
  CODE_EDITOR_SERVICE = 'codeEditorService',
  TEXT_MODEL_SERVICE = 'textModelService',
  CONTEXT_VIEW_SERVICE = 'contextViewService',
  COMMAND_SERVICE = 'commandService',
  CONTEXT_KEY_SERVICE = 'contextKeyService',
  BULK_EDIT_SERVICE = 'IWorkspaceEditService',
  OPENER_SERVICE = 'openerService',
}

export abstract class MonacoService {
  public abstract onMonacoLoaded: Event<boolean>;
  public abstract monacoLoaded: Promise<void>;

  public abstract async createCodeEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IEditorConstructionOptions,
    overrides?: {[key: string]: any},
  ): Promise<monaco.editor.IStandaloneCodeEditor>;

  public abstract async loadMonaco(): Promise<void>;

  public abstract async createDiffEditor(monacoContainer: HTMLElement,
                                         options?: monaco.editor.IDiffEditorConstructionOptions, overrides?: {[key: string]: any}): Promise<monaco.editor.IDiffEditor>;

  public abstract registerOverride(serviceName: ServiceNames, service: any): void;

  public abstract testTokenize(text: string, languageId: string): void;

  public abstract getOverride(serviceName: ServiceNames): any;
}

export const MonacoContribution = Symbol('MonacoContribution');

export interface MonacoContribution {
  onMonacoLoaded?(monacoService: MonacoService);
  onContextKeyServiceReady?(contextKeyService: IContextKeyService);
}

export const Extensions = {
  JSONContribution: 'base.contributions.json',
};

export interface ISchemaContributions {
  schemas: { [id: string]: IJSONSchema };
}

// FIXME: should named as IJSONSchemaRegistry ?
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
  register(config: JsonSchemaConfiguration): IDisposable;
  getConfigurations(): JsonSchemaConfiguration[];
}

export const ISchemaStore = Symbol('ISchemaStore');

export interface MimeAssociation {
  readonly id: string;
  readonly filePattern: string;
}

export const IMimeService = Symbol('IMimeService');
export interface IMimeService {
  /**
   * 更新 mime
   */
  updateMime(): void;
}

export interface SuggestEventPayload {
  eventType: 'onDidSelect' | 'onDidHide' | 'onDidShow' | 'onDidFocus';
  data: suggest.ISelectedSuggestion | suggest.SuggestWidget;
}
export class SuggestEvent extends BasicEvent<SuggestEventPayload> {}
