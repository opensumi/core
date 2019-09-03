import { IDisposable, combinedDisposable, dispose } from '@ali/ide-core-common/lib/disposable';
import { Emitter, Event } from '@ali/ide-core-common';
import { ISplice, ISequence } from '@ali/ide-core-common/lib/sequence';

import { ISCMRepository, ISCMResourceGroup, ISCMResource } from '../common';
import { observable, computed, action } from 'mobx';
import { createContext } from 'react';

export interface ISpliceEvent<T> {
  index: number;
  deleteCount: number;
  elements: T[];
}

export interface IGroupItem {
  readonly group: ISCMResourceGroup;
  visible: boolean;
  readonly disposable: IDisposable;
}

export type ISCMDataItem = ISCMResourceGroup | ISCMResource;

export class ResourceGroupSplicer {
  private items: IGroupItem[] = [];
  private disposables: IDisposable[] = [];

  private _onDidSplice = new Emitter<ISpliceEvent<ISCMDataItem>>();
  readonly onDidSplice: Event<ISpliceEvent<ISCMDataItem>> = this._onDidSplice.event;

  constructor(groupSequence: ISequence<ISCMResourceGroup>) {
    groupSequence.onDidSplice(this.onDidSpliceGroups, this, this.disposables);
    this.onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: groupSequence.elements });
  }

  private onDidSpliceGroups({ start, deleteCount, toInsert }: ISplice<ISCMResourceGroup>): void {
    let absoluteStart = 0;

    for (let i = 0; i < start; i++) {
      const item = this.items[i];
      absoluteStart += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    let absoluteDeleteCount = 0;

    for (let i = 0; i < deleteCount; i++) {
      const item = this.items[start + i];
      absoluteDeleteCount += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    const itemsToInsert: IGroupItem[] = [];
    const absoluteToInsert: Array<ISCMResourceGroup | ISCMResource> = [];

    for (const group of toInsert) {
      const visible = isGroupVisible(group);

      if (visible) {
        absoluteToInsert.push(group);
      }

      for (const element of group.elements) {
        absoluteToInsert.push(element);
      }

      const disposable = combinedDisposable([
        group.onDidChange(() => this.onDidChangeGroup(group)),
        group.onDidSplice((splice) => this.onDidSpliceGroup(group, splice)),
      ]);

      itemsToInsert.push({ group, visible, disposable });
    }

    const itemsToDispose = this.items.splice(start, deleteCount, ...itemsToInsert);

    for (const item of itemsToDispose) {
      item.disposable.dispose();
    }

    this._onDidSplice.fire({
      index: absoluteStart,
      deleteCount: absoluteDeleteCount,
      elements: absoluteToInsert,
    });
  }

  private onDidChangeGroup(group: ISCMResourceGroup): void {
    const itemIndex = this.items.findIndex((item) => item.group === group);

    if (itemIndex < 0) {
      return;
    }

    const item = this.items[itemIndex];
    const visible = isGroupVisible(group);

    if (item.visible === visible) {
      return;
    }

    let absoluteStart = 0;

    for (let i = 0; i < itemIndex; i++) {
      const item = this.items[i];
      absoluteStart += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    if (visible) {
      this._onDidSplice.fire({
        index: absoluteStart,
        deleteCount: 0,
        elements: [group, ...group.elements],
      });
    } else {
      this._onDidSplice.fire({
        index: absoluteStart,
        deleteCount: 1 + group.elements.length,
        elements: [],
      });
    }

    item.visible = visible;
  }

  private onDidSpliceGroup(group: ISCMResourceGroup, { start, deleteCount, toInsert }: ISplice<ISCMResource>): void {
    const itemIndex = this.items.findIndex((item) => item.group === group);

    if (itemIndex < 0) {
      return;
    }

    const item = this.items[itemIndex];
    const visible = isGroupVisible(group);

    if (!item.visible && !visible) {
      return;
    }

    let absoluteStart = start;

    for (let i = 0; i < itemIndex; i++) {
      const item = this.items[i];
      absoluteStart += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    if (item.visible && !visible) {
      this._onDidSplice.fire({
        index: absoluteStart,
        deleteCount: 1 + deleteCount,
        elements: toInsert,
      });
    } else if (!item.visible && visible) {
      this._onDidSplice.fire({
        index: absoluteStart,
        deleteCount,
        elements: [group, ...toInsert],
      });
    } else {
      this._onDidSplice.fire({
        index: absoluteStart + 1,
        deleteCount,
        elements: toInsert,
      });
    }

    item.visible = visible;
  }

  dispose(): void {
    this.onDidSpliceGroups({ start: 0, deleteCount: this.items.length, toInsert: [] });
    this.disposables = dispose(this.disposables);
  }
}

function isGroupVisible(group: ISCMResourceGroup) {
  return group.elements.length > 0 || !group.hideWhenEmpty;
}

class ViewModel {
  @observable
  repoList = observable.array<ISCMRepository>([]);

  @computed
  get selectedRepos() {
    return this.repoList.filter((repo) => repo.selected);
  }

  @observable
  scmList = observable.array<ISCMDataItem>([]);

  @action
  changeSelectedRepos(repos: ISCMRepository[]) {
    const providerIds = repos.map((repo) => repo.provider.id);
    this.repoList.forEach((item: ISCMRepository) => {
      item.setSelected(providerIds.includes(item.provider.id));
    });
  }

  @action
  addRepo(repo: ISCMRepository) {
    if (this.repoList.indexOf(repo) > -1) {
      console.warn('depulicate scm repo', repo);
      return;
    }
    this.repoList.push(repo);
  }

  @action
  deleteRepo(repo: ISCMRepository) {
    const index = this.repoList.indexOf(repo);
    if (index < 0) {
      console.warn('no such scm repo', repo);
      return;
    }
    this.repoList.splice(index, 1);
  }

  @action
  spliceSCMList = (start: number, deleteCount: number, ...toInsert: ISCMDataItem[]) => {
    this.scmList.splice(start, deleteCount, ...toInsert);
  }
}

export const ViewModelContext = createContext(new ViewModel());
