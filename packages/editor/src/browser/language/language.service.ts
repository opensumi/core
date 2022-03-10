import { Autowired, Injectable } from '@opensumi/di';
import {
  URI,
  IDisposable,
  Disposable,
  MarkerManager,
  IMarkerData,
  IRelatedInformation,
  MarkerSeverity,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  DiagnosticSeverity,
  DiagnosticRelatedInformation,
  Diagnostic,
  Language,
  WorkspaceSymbolProvider,
  ILanguageService,
} from '../../common';

import { MonacoDiagnosticCollection } from './diagnostic-collection';

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

function reviveSeverity(severity: MarkerSeverity): DiagnosticSeverity {
  switch (severity) {
    case MarkerSeverity.Error:
      return DiagnosticSeverity.Error;
    case MarkerSeverity.Warning:
      return DiagnosticSeverity.Warning;
    case MarkerSeverity.Info:
      return DiagnosticSeverity.Information;
    case MarkerSeverity.Hint:
      return DiagnosticSeverity.Hint;
  }
}

function reviveRange(startLine: number, startColumn: number, endLine: number, endColumn: number): any {
  // note: language server range is 0-based, marker is 1-based, so need to deduct 1 here
  return {
    start: {
      line: startLine - 1,
      character: startColumn - 1,
    },
    end: {
      line: endLine - 1,
      character: endColumn - 1,
    },
  };
}

function reviveRelated(related: IRelatedInformation): DiagnosticRelatedInformation {
  return {
    message: related.message,
    location: {
      uri: related.resource,
      range: reviveRange(related.startLineNumber, related.startColumn, related.endLineNumber, related.endColumn),
    },
  };
}

function reviveMarker(marker: IMarkerData): Diagnostic {
  const monacoMarker: Diagnostic = {
    code: marker.code,
    severity: reviveSeverity(marker.severity) as any,
    range: reviveRange(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn),
    message: marker.message,
    source: marker.source,
    relatedInformation: undefined,
    tags: marker.tags as number[],
  };

  if (marker.relatedInformation) {
    monacoMarker.relatedInformation = marker.relatedInformation.map(reviveRelated);
  }

  return monacoMarker;
}

@Injectable()
export class LanguageService implements ILanguageService {
  @Autowired()
  private markerManager: MarkerManager;

  protected readonly markers = new Map<string, MonacoDiagnosticCollection>();

  readonly workspaceSymbolProviders: WorkspaceSymbolProvider[] = [];

  constructor() {
    for (const uri of this.markerManager.getResources()) {
      this.updateMarkers(new URI(uri));
    }
    this.markerManager.onMarkerChanged((uris) => {
      if (uris) {
        uris.forEach((uri) => this.updateMarkers(new URI(uri)));
      }
    });
  }

  get languages(): Language[] {
    return [...this.mergeLanguages(monaco.languages.getLanguages()).values()];
  }

  getLanguage(languageId: string): Language | undefined {
    return this.mergeLanguages(monaco.languages.getLanguages().filter((language) => language.id === languageId)).get(
      languageId,
    );
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
    for (const marker of this.markerManager.getMarkers({ resource: uri.toString() })) {
      const diagnostics = owners.get(marker.type) || [];
      diagnostics.push(reviveMarker(marker));
      owners.set(marker.type, diagnostics);
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
