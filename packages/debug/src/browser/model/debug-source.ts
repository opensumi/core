import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugSession } from '../debug-session';
import { URI, Uri } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { WorkbenchEditorService, IResourceOpenOptions } from '@ali/ide-editor';
import { DebugModel } from '../editor/debug-model';

export class DebugSourceData {
  readonly raw: DebugProtocol.Source;
}

export class DebugSource extends DebugSourceData {

  constructor(
    protected readonly session: DebugSession,
    protected readonly labelProvider: LabelService,
    protected readonly model: DebugModel,
    protected readonly workbenchEditorService: WorkbenchEditorService,
  ) {
    super();
  }

  get uri(): URI {
    return DebugSource.toUri(this.raw);
  }

  update(data: Partial<DebugSourceData>): void {
    Object.assign(this, data);
  }

  async open(options: IResourceOpenOptions) {
    await this.workbenchEditorService.open(this.uri, options);
    this.model.hitBreakpoint();
  }

  async load(): Promise<string> {
    const source = this.raw;
    const sourceReference = source.sourceReference!;
    const response = await this.session.sendRequest('source', {
      sourceReference,
      source,
    });
    return response.body.content;
  }

  get inMemory(): boolean {
    return this.uri.scheme === DebugSource.SCHEME;
  }

  get name(): string {
    if (this.inMemory) {
      return this.raw.name || this.uri.path.base || this.uri.path.toString();
    }
    return this.labelProvider.getName(this.uri);
  }

  get longName(): string {
    if (this.inMemory) {
      return this.name;
    }
    return this.labelProvider.getLongName(this.uri);
  }

  static SCHEME = 'debug';
  static SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9\+\-\.]+:/;
  static toUri(raw: DebugProtocol.Source): URI {
    if (raw.sourceReference && raw.sourceReference > 0) {
      return new URI().withScheme(DebugSource.SCHEME).withPath(raw.name!).withQuery(String(raw.sourceReference));
    }
    if (!raw.path) {
      throw new Error('Unrecognized source type: ' + JSON.stringify(raw));
    }
    if (raw.path.match(DebugSource.SCHEME_PATTERN)) {
      return new URI(raw.path);
    }
    return new URI(Uri.file(raw.path));
  }
}
