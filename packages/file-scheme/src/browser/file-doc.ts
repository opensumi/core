import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  Emitter,
  Event,
  IEditorDocumentChange,
  IEditorDocumentModelSaveResult,
  ISchemaStore,
  IDisposable,
  Disposable,
  IJSONSchemaRegistry,
  replaceLocalizePlaceholder,
  PreferenceService,
  Schemes,
  CancellationToken,
  MaybePromise,
} from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { IEditorDocumentModelContentProvider } from '@opensumi/ide-editor/lib/browser';
import { BaseFileSystemEditorDocumentProvider } from '@opensumi/ide-editor/lib/browser/fs-resource/fs-editor-doc';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { FILE_SAVE_BY_CHANGE_THRESHOLD, IFileSchemeDocClient } from '../common';

@Injectable()
export class FileSchemeDocumentProvider
  extends BaseFileSystemEditorDocumentProvider
  implements IEditorDocumentModelContentProvider
{
  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(IFileSchemeDocClient)
  protected readonly fileSchemeDocClient: IFileSchemeDocClient;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(IHashCalculateService)
  private readonly hashCalculateService: IHashCalculateService;

  handlesUri(uri: URI): number {
    return uri.scheme === Schemes.file ? 20 : -1;
  }

  handlesScheme() {
    return false; // dummy, 走handlesUri
  }

  provideEncoding(uri: URI) {
    return super.provideEncoding(uri);
  }

  async saveDocumentModel(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding: string,
    ignoreDiff = false,
    eol: EOL = EOL.LF,
    token?: CancellationToken,
  ): Promise<IEditorDocumentModelSaveResult> {
    const baseMd5 = this.hashCalculateService.calculate(baseContent);
    if (content.length > FILE_SAVE_BY_CHANGE_THRESHOLD) {
      return await this.fileSchemeDocClient.saveByChange(
        uri.toString(),
        {
          baseMd5,
          changes,
          eol,
        },
        encoding,
        ignoreDiff,
        token,
      );
    } else {
      return await this.fileSchemeDocClient.saveByContent(
        uri.toString(),
        {
          baseMd5,
          content,
        },
        encoding,
        ignoreDiff,
        token,
      );
    }
  }

  async provideEditorDocumentModelContentMd5(uri: URI, encoding?: string): Promise<string | undefined> {
    return this.fileSchemeDocClient.getMd5(uri.toString(), encoding);
  }
}

@Injectable()
export class VscodeSchemeDocumentProvider implements IEditorDocumentModelContentProvider {
  isReadonly(uri: URI) {
    return true;
  }

  @Autowired(ISchemaStore)
  schemaStore: ISchemaStore;

  @Autowired(IJSONSchemaRegistry)
  jsonRegistry: IJSONSchemaRegistry;

  private _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  private listeners: { [uri: string]: IDisposable } = {};

  // 在main进程将vscode scheme获取model的方法给定义好，在json schema store，把 fileMatch 与 vscode scheme 的 url 关联起来
  handlesScheme(scheme: string) {
    return scheme === 'vscode';
  }

  async provideEditorDocumentModelContent(uri: URI, encoding) {
    const content = this.getSchemaContent(uri);
    return replaceLocalizePlaceholder(content)!;
  }

  protected getSchemaContent(uri: URI): string {
    const uriString = uri.toString();
    const schema = this.jsonRegistry.getSchemaContributions().schemas[uriString];
    if (schema) {
      const modelContent = JSON.stringify(schema);
      if (!this.listeners[uriString]) {
        const disposable = Disposable.create(() => {
          this.jsonRegistry.onDidChangeSchema((schemaUri) => {
            if (schemaUri === uriString) {
              this._onDidChangeContent.fire(uri);
            }
          });
        });
        this.listeners[uriString] = disposable;
      }
      return modelContent;
    }
    return '{}';
  }

  onDidDisposeModel(uri: URI) {
    if (uri.toString()) {
      this.listeners[uri.toString()].dispose();
      delete this.listeners[uri.toString()];
    }
  }
}

@Injectable()
export class WalkThroughSnippetSchemeDocumentProvider implements IEditorDocumentModelContentProvider {
  private documentContentMaps = new Map<string, string>();

  handlesScheme(scheme: string) {
    return scheme === Schemes.walkThroughSnippet;
  }

  provideEditorDocumentModelContent(uri: URI): MaybePromise<string> {
    if (!this.documentContentMaps.has(uri.toString())) {
      this.documentContentMaps.set(uri.toString(), '');
    }

    return this.documentContentMaps.get(uri.toString())!;
  }

  isReadonly(): MaybePromise<boolean> {
    return false;
  }

  private _onDidChangeContent: Emitter<URI> = new Emitter();
  onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  preferLanguageForUri() {
    return 'plaintext';
  }
}
