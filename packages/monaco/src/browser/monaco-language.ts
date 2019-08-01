import { Autowired, Injectable } from '@ali/common-di';
import { MarkerManager } from './marker-collection';
import { MonacoDiagnosticCollection } from './monaco-diagnostic-collection';
import { URI, IDisposable, Disposable } from '@ali/ide-core-common';
import { Diagnostic, Language, WorkspaceSymbolProvider } from '../common';

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

@Injectable()
export class MonacoLanguage {

  @Autowired()
  markerManager: MarkerManager<any>;

  protected readonly markers = new Map<string, MonacoDiagnosticCollection>();

  readonly workspaceSymbolProviders: WorkspaceSymbolProvider[] = [];

  constructor() {
    for (const uri of this.markerManager.getUris()) {
      this.updateMarkers(new URI(uri));
    }
    this.markerManager.onDidChangeMarkers((uri) => this.updateMarkers(uri));
  }

  get languages(): Language[] {
    return [...this.mergeLanguages(monaco.languages.getLanguages()).values()];
  }

  getLanguage(languageId: string): Language | undefined {
    return this.mergeLanguages(monaco.languages.getLanguages().filter((language) => language.id === languageId)).get(languageId);
  }

  protected mergeLanguages(registered: monaco.languages.ILanguageExtensionPoint[]): Map<string, Mutable<Language>> {
    const languages = new Map<string, Mutable<Language>>();
    for (const { id, aliases, extensions, filenames } of registered) {
      const merged = languages.get(id) || {
        id,
        name: '',
        extensions: new Set(),
        filenames: new Set(),
      };
      if (!merged.name && aliases && aliases.length) {
        merged.name = aliases[0];
      }
      if (extensions && extensions.length) {
        for (const extension of extensions) {
          merged.extensions.add(extension);
        }
      }
      if (filenames && filenames.length) {
        for (const filename of filenames) {
          merged.filenames.add(filename);
        }
      }
      languages.set(id, merged);
    }
    for (const [id, language] of languages) {
      if (!language.name) {
        language.name = id;
      }
    }
    return languages;
  }

  registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider): IDisposable {
    this.workspaceSymbolProviders.push(provider);
    return Disposable.create(() => {
        const index = this.workspaceSymbolProviders.indexOf(provider);
        if (index !== -1) {
            this.workspaceSymbolProviders.splice(index, 1);
        }
    });
  }

  protected updateMarkers(uri: URI): void {
    const uriString = uri.toString();
    const owners = new Map<string, Diagnostic[]>();
    for (const marker of this.markerManager.findMarkers({ uri })) {
      const diagnostics = owners.get(marker.owner) || [];
      diagnostics.push(marker.data);
      owners.set(marker.owner, diagnostics);
    }
    const toClean = new Set<string>(this.markers.keys());
    for (const [owner, diagnostics] of owners) {
      toClean.delete(owner);
      const collection = this.markers.get(owner) || new MonacoDiagnosticCollection(owner);
      collection.set(uriString, diagnostics);
      this.markers.set(owner, collection);
    }
    for (const owner of toClean) {
      const collection = this.markers.get(owner);
      if (collection) {
        collection.set(uriString, []);
      }
    }
  }
}
