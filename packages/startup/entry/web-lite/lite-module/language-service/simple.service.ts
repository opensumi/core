import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import type * as vscode from 'vscode';
import { DocumentSelector, HoverProvider, CancellationToken, DefinitionProvider, ReferenceProvider } from 'vscode';
import { DocumentFilter } from 'vscode-languageserver-protocol';

import { Autowired, Injectable, ConstructorOf } from '@opensumi/di';
import { Uri, URI, LRUMap, DisposableCollection } from '@opensumi/ide-core-common';
import { IEditorDocumentModelService, LanguageSelector } from '@opensumi/ide-editor/lib/browser';
import { ExtensionDocumentDataManager, IExtHostLanguages } from '@opensumi/ide-extension/lib/common/vscode';
import { MonacoModelIdentifier, testGlob } from '@opensumi/ide-extension/lib/common/vscode';
import { fromLanguageSelector } from '@opensumi/ide-extension/lib/common/vscode/converter';
import { Disposable } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import {
  SerializedDocumentFilter,
  Hover,
  Position,
  Definition,
  DefinitionLink,
  ReferenceContext,
  Location,
} from '@opensumi/ide-extension/lib/common/vscode/model.api';
import { ExtHostDocumentData } from '@opensumi/ide-extension/lib/hosted/api/vscode/doc/ext-data.host';
import { Adapter } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.language';
import { DefinitionAdapter } from '@opensumi/ide-extension/lib/hosted/api/vscode/language/definition';
import { HoverAdapter } from '@opensumi/ide-extension/lib/hosted/api/vscode/language/hover';
import { ReferenceAdapter } from '@opensumi/ide-extension/lib/hosted/api/vscode/language/reference';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

@Injectable()
class LiteDocumentDataManager implements Partial<ExtensionDocumentDataManager> {
  @Autowired(IEditorDocumentModelService)
  private readonly docManager: IEditorDocumentModelService;

  getDocumentData(path: Uri | string) {
    const uri = path.toString();
    const docRef = this.docManager.getModelReference(new URI(path));
    if (!docRef) {
      return undefined;
    }

    const model = docRef.instance.getMonacoModel();

    const docModel = {
      lines: model.getLinesContent(),
      eol: docRef.instance.eol,
      languageId: docRef.instance.languageId,
      versionId: model.getVersionId(),
      dirty: docRef.instance.dirty,
    };

    return new ExtHostDocumentData(
      {
        $trySaveDocument() {
          return docRef.instance.save();
        },
      } as any,
      Uri.parse(uri),
      docModel.lines,
      docModel.eol,
      docModel.languageId,
      docModel.versionId,
      docModel.dirty,
    );
  }
}

/**
 * IExtHostLanguages 的简单实现
 * 主要保留以下几个 API 供 lsif 服务使用
 *  * registerHoverProvider
 *  * registerDefinitionProvider
 *  * registerReferenceProvider
 */
@Injectable()
export class SimpleLanguageService implements Partial<IExtHostLanguages> {
  private callId = 0;
  private adaptersMap = new Map<number, Adapter>();
  private readonly disposables = new Map<number, monaco.IDisposable>();

  private languageFeatureEnabled = new LRUMap<string, boolean>(200, 100);

  @Autowired(LiteDocumentDataManager)
  private readonly documents: ExtensionDocumentDataManager;

  private nextCallId(): number {
    return this.callId++;
  }

  private createDisposable(callId: number): Disposable {
    return new Disposable(() => {
      this.adaptersMap.delete(callId);
    });
  }

  private addNewAdapter(adapter: Adapter): number {
    const callId = this.nextCallId();
    this.adaptersMap.set(callId, adapter);
    return callId;
  }

  // tslint:disable-next-line:no-any
  private withAdapter<A, R>(
    handle: number,
    constructor: ConstructorOf<A>,
    callback: (adapter: A) => Promise<R>,
  ): Promise<R> {
    const adapter = this.adaptersMap.get(handle);
    if (!(adapter instanceof constructor)) {
      return Promise.reject(new Error('no adapter found'));
    }
    return callback(adapter as A);
  }

  private transformDocumentSelector(selector: vscode.DocumentSelector): SerializedDocumentFilter[] {
    if (Array.isArray(selector)) {
      return selector.map((sel) => this.doTransformDocumentSelector(sel)!);
    }

    return [this.doTransformDocumentSelector(selector)!];
  }

  private doTransformDocumentSelector(selector: string | vscode.DocumentFilter): SerializedDocumentFilter | undefined {
    if (typeof selector === 'string') {
      return {
        $serialized: true,
        language: selector,
      };
    }

    if (selector) {
      return {
        $serialized: true,
        language: selector.language,
        scheme: selector.scheme,
        pattern: selector.pattern,
      };
    }

    return undefined;
  }

  async getLanguages(): Promise<string[]> {
    return this.$getLanguages();
  }

  // TODO: I need this
  // ### Hover begin
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
    const callId = this.addNewAdapter(new HoverAdapter(provider, this.documents));
    this.$registerHoverProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideHover(
    handle: number,
    resource: any,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | undefined> {
    return this.withAdapter(handle, HoverAdapter, (adapter) => adapter.provideHover(resource, position, token));
  }

  // TODO: I need this
  $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const hoverProvider = this.createHoverProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerHoverProvider(language, hoverProvider));
      }
    }

    this.disposables.set(handle, disposable);
  }

  protected createHoverProvider(handle: number, selector?: LanguageSelector): monaco.languages.HoverProvider {
    return {
      provideHover: (model, position, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        return this.$provideHover(handle, model.uri, position, token).then((v) => v!);
      },
    };
  }
  // ### Hover end

  // TODO: I need this
  // ### Definition provider begin
  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable {
    const callId = this.addNewAdapter(new DefinitionAdapter(provider, this.documents));
    this.$registerDefinitionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDefinition(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, DefinitionAdapter, (adapter) =>
      adapter.provideDefinition(resource, position, token),
    );
  }

  $registerDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const definitionProvider = this.createDefinitionProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDefinitionProvider(language, definitionProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createDefinitionProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.DefinitionProvider {
    return {
      provideDefinition: async (model, position, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        const result = await this.$provideDefinition(handle, model.uri, position, token);
        if (!result) {
          return undefined!;
        }
        if (Array.isArray(result)) {
          const definitionLinks: monaco.languages.LocationLink[] = [];
          for (const item of result) {
            definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
          }
          return definitionLinks as monaco.languages.LocationLink[];
        } else {
          // single Location
          return {
            uri: monaco.Uri.revive(result.uri),
            range: result.range,
          } as monaco.languages.Definition;
        }
      },
    };
  }
  // ### Definition provider end

  // TODO: I need this
  // ### Code Reference Provider begin
  registerReferenceProvider(selector: DocumentSelector, provider: ReferenceProvider): Disposable {
    const callId = this.addNewAdapter(new ReferenceAdapter(provider, this.documents));
    this.$registerReferenceProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideReferences(
    handle: number,
    resource: Uri,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken,
  ): Promise<Location[] | undefined> {
    return this.withAdapter(handle, ReferenceAdapter, (adapter) =>
      adapter.provideReferences(resource, position, context, token),
    );
  }

  // TODO: I need this
  $registerReferenceProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const referenceProvider = this.createReferenceProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerReferenceProvider(language, referenceProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createReferenceProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.ReferenceProvider {
    return {
      provideReferences: (model, position, context, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.$provideReferences(handle, model.uri, position, context, token).then((result) => {
          if (!result) {
            return undefined!;
          }

          if (Array.isArray(result)) {
            const references: monaco.languages.Location[] = [];
            for (const item of result) {
              references.push({ ...item, uri: monaco.Uri.revive(item.uri) });
            }
            return references;
          }

          return undefined!;
        });
      },
    };
  }
  // ### Code Reference Provider end

  protected getUniqueLanguages(): string[] {
    const languages: string[] = [];
    // 会有重复
    const allLanguages = monaco.languages.getLanguages().map((l) => l.id);
    for (const language of allLanguages) {
      if (languages.indexOf(language) === -1) {
        languages.push(language);
      }
    }
    return languages;
  }

  protected matchLanguage(selector: LanguageSelector | undefined, languageId: string): boolean {
    if (Array.isArray(selector)) {
      return selector.some((filter) => this.matchLanguage(filter, languageId));
    }

    if (DocumentFilter.is(selector)) {
      return !selector.language || selector.language === languageId;
    }

    return selector === languageId;
  }

  protected matchModel(selector: LanguageSelector | undefined, model: MonacoModelIdentifier): boolean {
    if (Array.isArray(selector)) {
      return selector.some((filter) => this.matchModel(filter, model));
    }
    if (DocumentFilter.is(selector)) {
      if (!!selector.language && selector.language !== model.languageId) {
        return false;
      }
      if (!!selector.scheme && selector.scheme !== model.uri.scheme) {
        return false;
      }
      if (!!selector.pattern && !testGlob(selector.pattern, model.uri.path)) {
        return false;
      }
      return true;
    }
    return selector === model.languageId;
  }

  isLanguageFeatureEnabled(model: ITextModel) {
    const uriString = model.uri.toString();
    if (!this.languageFeatureEnabled.has(uriString)) {
      this.languageFeatureEnabled.set(uriString, model.getValueLength() < 2 * 1024 * 1024);
    }
    return this.languageFeatureEnabled.get(uriString);
  }

  $getLanguages(): string[] {
    return monaco.languages.getLanguages().map((l) => l.id);
  }
}
