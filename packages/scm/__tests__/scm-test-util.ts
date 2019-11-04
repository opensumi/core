import { Sequence, ISplice } from '@ali/ide-core-common/lib/sequence';
import { Event, Emitter } from '@ali/ide-core-common/lib/event';
import { Uri } from '@ali/ide-core-common/lib/uri';

import { ISCMProvider, ISCMResourceGroup, ISCMResource } from '../src/common';

export class MockSCMProvider implements ISCMProvider {
  readonly groups = new Sequence<ISCMResourceGroup>();

  private _label: string;
  private _id: string;
  private _contextValue: string;

  public rootUri: Uri;

  constructor(id: number) {
    this._label = 'scm_label_' + id;
    this._id = 'scm_id_' + id;
    this._contextValue = 'scm_contextValue_' + id;
  }

  get label() { return this._label; }
  get id() { return this._id; }
  get contextValue() { return this._contextValue; }

  readonly onDidChangeResources: Event<void> = Event.None;
  readonly onDidChange: Event<void> = Event.None;

  async getOriginalResource() { return null; }
  toJSON() { return { $mid: 5 }; }

  registerGroup(group: ISCMResourceGroup) {
    this.groups.splice(this.groups.elements.length, 0, [group]);
  }

  dispose() {}
}

export class MockSCMResourceGroup implements ISCMResourceGroup {
  private _label: string;
  private _id: string;

  readonly provider: ISCMProvider;

  private _hideWhenEmpty: boolean = false;
  readonly elements: ISCMResource[] = [];

  private _onDidSplice = new Emitter<ISplice<ISCMResource>>();
  readonly onDidSplice = this._onDidSplice.event;

  get hideWhenEmpty(): boolean { return !!this._hideWhenEmpty; }

  private _onDidChange = new Emitter<void>();
  readonly onDidChange: Event<void> = this._onDidChange.event;

  get label() { return this._label; }
  get id() { return this._id; }

  constructor(id) {
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

  toJSON: () => { $mid: 4 };
}

export class MockSCMResource implements ISCMResource {
  private _resourceGroup: ISCMResourceGroup;
  readonly sourceUri = Uri.file('/test/workspace');
  readonly decorations: {};

  get resourceGroup() { return this._resourceGroup; }

  constructor(resourceGroup: ISCMResourceGroup) {
    this._resourceGroup = resourceGroup;
  }

  async open() {}
  toJSON: () => { $mid: 3 };
}
