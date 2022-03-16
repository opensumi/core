import { URI, Uri, Event, Emitter } from '@opensumi/ide-core-common';
import { Sequence, ISplice } from '@opensumi/ide-core-common/lib/sequence';

import { ISCMProvider, ISCMResourceGroup, ISCMResource, VSCommand } from '../src/common';

// use the `git scheme` from vscode.git
export function toGitUri(uri: Uri, ref: string): Uri {
  return uri.with({
    scheme: 'git',
    path: uri.path,
    query: JSON.stringify({
      path: uri.fsPath,
      ref,
    }),
  });
}

export class MockSCMProvider implements ISCMProvider {
  public groups = new Sequence<ISCMResourceGroup>();

  private _label: string;
  private _id: string;
  private _contextValue: string;

  public rootUri: Uri | undefined;

  constructor(id: number, scheme = 'git', rootUri = Uri.file('/test/workspace')) {
    this._label = 'scm_label_' + id;
    this._id = 'scm_id_' + id;
    this._contextValue = scheme;
    this.rootUri = rootUri;
  }

  get label() {
    return this._label;
  }
  get id() {
    return this._id;
  }
  get contextValue() {
    return this._contextValue;
  }

  public count: number;
  public statusBarCommands: VSCommand[] | undefined = [];

  public onDidChangeStatusBarCommandsEmitter = new Emitter<VSCommand[]>();
  readonly onDidChangeStatusBarCommands: Event<VSCommand[]> = this.onDidChangeStatusBarCommandsEmitter.event;

  public onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

  public onDidChangeResourcesEmitter = new Emitter<void>();
  readonly onDidChangeResources: Event<void> = this.onDidChangeResourcesEmitter.event;

  async getOriginalResource(uri: Uri): Promise<Uri | null> {
    const rootURI = new URI(this.rootUri);
    if (rootURI.isEqualOrParent(new URI(uri))) {
      // convert it to git uri
      // ref# head
      return toGitUri(uri, '');
    }
    return null;
  }

  toJSON() {
    return { $mid: 5 };
  }

  registerGroup(group: ISCMResourceGroup) {
    this.groups.splice(this.groups.elements.length, 0, [group]);
  }

  dispose() {}
}

export class MockSCMResourceGroup implements ISCMResourceGroup {
  private _label: string;
  private _id: string;

  readonly provider: ISCMProvider;

  private _hideWhenEmpty = false;
  public elements: ISCMResource[] = [];

  private _onDidSplice = new Emitter<ISplice<ISCMResource>>();
  readonly onDidSplice = this._onDidSplice.event;

  get hideWhenEmpty(): boolean {
    return !!this._hideWhenEmpty;
  }

  private _onDidChange = new Emitter<void>();
  readonly onDidChange: Event<void> = this._onDidChange.event;

  get label() {
    return this._label;
  }
  get id() {
    return this._id;
  }

  constructor(provider: ISCMProvider, id: number) {
    this.provider = provider;
    this._label = 'test_scm_resource_group_' + id;
    this._id = 'scm_resource_group_' + id;
  }

  splice(start: number, deleteCount: number, toInsert: ISCMResource[]) {
    this.elements.splice(start, deleteCount, ...toInsert);
    this._onDidSplice.fire({ start, deleteCount, toInsert });
  }

  updateHideWhenEmpty(updater: boolean): void {
    this._hideWhenEmpty = updater;
    this._onDidChange.fire();
  }

  toJSON() {
    return { $mid: 4 };
  }
}

export class MockSCMResource implements ISCMResource {
  private _resourceGroup: ISCMResourceGroup;
  readonly sourceUri = Uri.file('/test/workspace/src/a.ts');
  readonly decorations = {};

  get resourceGroup() {
    return this._resourceGroup;
  }

  constructor(
    resourceGroup: ISCMResourceGroup,
    fsPath: string | undefined,
    public readonly contextValue: string | undefined,
    public readonly command: VSCommand | undefined,
  ) {
    this._resourceGroup = resourceGroup;
    if (fsPath) {
      this.sourceUri = Uri.file(fsPath);
    }
  }

  async open() {}
  toJSON() {
    return { $mid: 3 };
  }
}
