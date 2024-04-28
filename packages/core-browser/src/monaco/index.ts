import { BasicEvent, Event, IDisposable, IJSONSchema } from '@opensumi/ide-core-common';
import { EditorContributionInstantiation } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';
import { SyncDescriptor } from '@opensumi/monaco-editor-core/esm/vs/platform/instantiation/common/descriptors';

import { IMergeEditorEditor } from './merge-editor-widget';

import type {
  ICodeEditor,
  IDiffEditor,
  IDiffEditorConstructionOptions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import type { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import type {
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import type { IFormattingEditProviderSelector } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/format';
import type {
  ISelectedSuggestion,
  SuggestWidget,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/suggest/browser/suggestWidget';
import type { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';
import type { BrandedService } from '@opensumi/monaco-editor-core/esm/vs/platform/instantiation/common/instantiation';

export * from './event';

export enum ServiceNames {
  CODE_EDITOR_SERVICE = 'codeEditorService',
  TEXT_MODEL_SERVICE = 'textModelService',
  CONTEXT_VIEW_SERVICE = 'contextViewService',
  COMMAND_SERVICE = 'commandService',
  CONTEXT_KEY_SERVICE = 'contextKeyService',
  BULK_EDIT_SERVICE = 'IWorkspaceEditService',
  OPENER_SERVICE = 'openerService',
  TELEMETRY_SERVICE = 'telemetryService',
}

export abstract class MonacoService {
  public abstract createCodeEditor(
    monacoContainer: HTMLElement,
    options?: IStandaloneEditorConstructionOptions,
    overrides?: { [key: string]: any },
  ): ICodeEditor;

  public abstract createDiffEditor(
    monacoContainer: HTMLElement,
    options?: IDiffEditorConstructionOptions,
    overrides?: { [key: string]: any },
  ): IDiffEditor;

  public abstract createMergeEditor(
    monacoContainer: HTMLElement,
    options?: IDiffEditorConstructionOptions,
    overrides?: { [key: string]: any },
  ): IMergeEditorEditor;

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
  formatters: Array<DocumentFormattingEditProvider | DocumentRangeFormattingEditProvider>,
  document: ITextModel,
) => DocumentFormattingEditProvider | DocumentRangeFormattingEditProvider;

export type IEditorExtensionContribution<T extends BrandedService[]> = (
  id: string,
  contribCtor: (new (editor: ICodeEditor, ...services: T) => IEditorContribution) | SyncDescriptor<IEditorContribution>,
  instantiation?: EditorContributionInstantiation,
) => void;

export interface MonacoContribution {
  registerOverrideService?(registry: MonacoOverrideServiceRegistry): void;

  registerMonacoDefaultFormattingSelector?(registry: (selector: IFormattingEditProviderSelector) => IDisposable): void;

  registerEditorExtensionContribution?<Services extends BrandedService[]>(
    register: IEditorExtensionContribution<Services>,
  ): void;

  /**
   * [{ id: association.id, mime: mimetype, filepattern: association.filePattern }]
   * @param register
   */
  registerPlatformLanguageAssociations?(register: (mime: MimeAssociation[]) => void): void;
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
  readonly filepattern: string;
  readonly mime: string;
}

export interface SuggestEventPayload {
  eventType: 'onDidSelect' | 'onDidHide' | 'onDidShow' | 'onDidFocus';
  data: ISelectedSuggestion | SuggestWidget;
}
export class SuggestEvent extends BasicEvent<SuggestEventPayload> {}
