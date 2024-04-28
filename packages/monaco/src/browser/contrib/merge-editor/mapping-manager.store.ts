import { action, computed, makeAutoObservable, observable } from 'mobx';

import { Injectable } from '@opensumi/di';

export interface IConflictsCount {
  total: number;
  resolved: number;
  lefted: number;
  nonConflicts: number;
}

export interface INonConflictingChangesResolvedCount {
  total: number;
  left: number;
  right: number;
  both: number;
  userManualResolveNonConflicts: boolean;
}

@Injectable()
export class MappingManagerDataStore {
  constructor() {
    makeAutoObservable(this);
  }

  @observable
  conflictsTotal = 0;

  @observable
  nonConflictsUnresolvedCount = 0;

  @observable
  conflictsResolvedCount = 0;

  @computed
  get conflictsCount(): IConflictsCount {
    return {
      total: this.conflictsTotal,
      resolved: this.conflictsResolvedCount,
      lefted: this.conflictsTotal - this.conflictsResolvedCount,
      nonConflicts: this.nonConflictsUnresolvedCount,
    };
  }

  @observable
  protected nonConflictingChangesResolvedTotal = 0;
  @observable
  protected nonConflictingChangesResolvedLeft = 0;
  @observable
  protected nonConflictingChangesResolvedRight = 0;
  @observable
  protected nonConflictingChangesResolvedBoth = 0;
  @observable
  protected userManualResolveNonConflicts = false;

  @action
  updateConflictsCount(data: Partial<Omit<IConflictsCount, 'lefted'>>) {
    if (typeof data.total !== 'undefined') {
      this.conflictsTotal = data.total;
    }
    if (typeof data.resolved !== 'undefined') {
      this.conflictsResolvedCount = data.resolved;
    }
    if (typeof data.nonConflicts !== 'undefined') {
      this.nonConflictsUnresolvedCount = data.nonConflicts;
    }
  }

  @computed
  get nonConflictingChangesResolvedCount(): INonConflictingChangesResolvedCount {
    return {
      total: this.nonConflictingChangesResolvedTotal,
      left: this.nonConflictingChangesResolvedLeft,
      right: this.nonConflictingChangesResolvedRight,
      both: this.nonConflictingChangesResolvedBoth,
      userManualResolveNonConflicts: this.userManualResolveNonConflicts,
    };
  }

  @action
  updateNonConflictingChangesResolvedCount(data: Partial<INonConflictingChangesResolvedCount>) {
    if (typeof data.total !== 'undefined') {
      this.nonConflictingChangesResolvedTotal = data.total;
    }
    if (typeof data.left !== 'undefined') {
      this.nonConflictingChangesResolvedLeft = data.left;
    }
    if (typeof data.right !== 'undefined') {
      this.nonConflictingChangesResolvedRight = data.right;
    }
    if (typeof data.both !== 'undefined') {
      this.nonConflictingChangesResolvedBoth = data.both;
    }
    if (typeof data.userManualResolveNonConflicts !== 'undefined') {
      this.userManualResolveNonConflicts = data.userManualResolveNonConflicts;
    }
  }
}
