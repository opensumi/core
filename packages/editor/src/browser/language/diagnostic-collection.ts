import { Disposable, DisposableCollection, IDisposable } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { Diagnostic, DiagnosticCollection, asMonacoDiagnostics } from '../../common';

type IMonacoModel = monaco.editor.ITextModel;
type IMonacoMarkerData = monaco.editor.IMarkerData;

export class MonacoDiagnosticCollection implements DiagnosticCollection {
  protected readonly diagnostics = new Map<string, MonacoModelDiagnostics | undefined>();
  protected readonly toDispose = new DisposableCollection();

  constructor(protected readonly name: string) {}

  dispose() {
    this.toDispose.dispose();
  }

  get(uri: string): Diagnostic[] {
    const diagnostics = this.diagnostics.get(uri);
    return diagnostics ? diagnostics.diagnostics : [];
  }

  set(uri: string, diagnostics: Diagnostic[]): void {
    const existing = this.diagnostics.get(uri);
    if (existing) {
      existing.diagnostics = diagnostics;
    } else {
      const modelDiagnostics = new MonacoModelDiagnostics(uri, diagnostics, this.name);
      this.diagnostics.set(uri, modelDiagnostics);
      this.toDispose.push(
        Disposable.create(() => {
          this.diagnostics.delete(uri);
          modelDiagnostics.dispose();
        }),
      );
    }
  }
}

export class MonacoModelDiagnostics implements IDisposable {
  readonly uri: monaco.Uri;
  protected _markers: IMonacoMarkerData[] = [];
  protected _diagnostics: Diagnostic[] = [];
  constructor(uri: string, diagnostics: Diagnostic[], readonly owner: string) {
    this.uri = monaco.Uri.parse(uri);
    this.diagnostics = diagnostics;
    monacoApi.editor.onDidCreateModel((model) => this.doUpdateModelMarkers(model));
  }

  set diagnostics(diagnostics: Diagnostic[]) {
    this._diagnostics = diagnostics;
    this._markers = asMonacoDiagnostics(diagnostics) || [];
    this.updateModelMarkers();
  }

  get diagnostics(): Diagnostic[] {
    return this._diagnostics;
  }

  get markers(): ReadonlyArray<IMonacoMarkerData> {
    return this._markers;
  }

  dispose(): void {
    this._markers = [];
    this.updateModelMarkers();
  }

  updateModelMarkers(): void {
    const model = monacoApi.editor.getModel(this.uri);
    this.doUpdateModelMarkers(model);
  }

  protected doUpdateModelMarkers(model: IMonacoModel | null): void {
    if (model && this.uri.toString() === model.uri.toString()) {
      monacoApi.editor.setModelMarkers(model, this.owner, this._markers);
    }
  }
}
