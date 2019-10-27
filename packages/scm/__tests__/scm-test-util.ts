import { Sequence } from '@ali/ide-core-common/lib/sequence';
import { Event } from '@ali/ide-core-common/lib/event';
import { Uri } from '@ali/ide-core-common/lib/uri';

import { ISCMProvider, ISCMResourceGroup } from '../src/common';

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

  dispose() {}
}
