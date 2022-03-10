import type {
  ICodeEditor,
  IDiffEditor,
  IEditorConstructionOptions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IDiffEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as suggest from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/suggest/suggestWidget';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

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

  public abstract createCodeEditor(
    monacoContainer: HTMLElement,
    options?: IEditorConstructionOptions,
    overrides?: { [key: string]: any },
  ): ICodeEditor;

  public abstract loadMonaco(): Promise<void>;

  public abstract createDiffEditor(
    monacoContainer: HTMLElement,
    options?: IDiffEditorConstructionOptions,
    overrides?: { [key: string]: any },
  ): IDiffEditor;

  public abstract registerOverride(serviceName: ServiceNames, service: any): void;

  public abstract testTokenize(text: string, languageId: string): void;

  public abstract getOverride(serviceName: ServiceNames): any;
}

export abstract class MonacoOverrideServiceRegistry {
  abstract registerOverrideService(serviceId: ServiceNames, service: any): void;

  abstract getRegisteredService<S>(serviceId: ServiceNames): S | undefined;

  abstract all(): { [serviceId: string]: any };
}

export const MonacoContribution = Symbol('MonacoContribution');

export type FormattingSelectorType = (
  formatters: Array<
    monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider
  >,
  document: ITextModel,
) => monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider;

export interface MonacoContribution {
  /**
   * @deprecated 请勿依赖 onMonacoLoaded
   * @param monacoService
   */
  onMonacoLoaded?(monacoService: MonacoService);
  /**
   * @deprecated 请勿依赖 onContextKeyServiceReady
   * @param contextKeyService
   */
  onContextKeyServiceReady?(contextKeyService: IContextKeyService);

  registerOverrideService?(registry: MonacoOverrideServiceRegistry): void;

  registerMonacoDefaultFormattingSelector?(registry: (selector: FormattingSelectorType) => void): void;
}

export const Extensions = {
  JSONContribution: 'base.contributions.json',
};

export interface ISchemaContributions {
  schemas: { [id: string]: IJSONSchema };
}

export interface IJSONSchemaRegistry {
  readonly onDidChangeSchema: Event<string>;

  registerSchema(uri: string, unresolvedSchemaContent: IJSONSchema, fileMatch: string[]): void;

  notifySchemaChanged(uri: string): void;

  getSchemaContributions(): ISchemaContributions;
}

export const IJSONSchemaRegistry = Symbol('IJSONSchemaRegistry');

export const JsonSchemaContribution = Symbol('JsonSchemaContribution');
export interface JsonSchemaContribution {
  registerSchema(registry: IJSONSchemaRegistry): void;
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
