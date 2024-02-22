import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import IMonacoModel = monaco.editor.IModel;
import IMonacoMarkerData = monaco.editor.IMarkerData;

// eslint-disable-next-line import/order
import { Disposable, DisposableCollection, IDisposable } from '@opensumi/ide-core-common';

// eslint-disable-next-line import/order
import { Diagnostic, DiagnosticCollection, asMonacoDiagnostics } from '../../common';

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
    monaco.editor.onDidCreateModel((model) => this.doUpdateModelMarkers(model));
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
    const model = monaco.editor.getModel(this.uri);
    this.doUpdateModelMarkers(model);
  }

  protected doUpdateModelMarkers(model: IMonacoModel | null): void {
    if (model && this.uri.toString() === model.uri.toString()) {
      monaco.editor.setModelMarkers(model, this.owner, this._markers);
    }
  }
}
