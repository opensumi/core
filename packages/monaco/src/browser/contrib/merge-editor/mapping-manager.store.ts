import { action, computed, makeAutoObservable, observable } from 'mobx';

import { Injectable } from '@opensumi/di';
import { formatLocalize, localize } from '@opensumi/ide-core-browser';

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

  summary() {
    const conflictsCount = this.conflictsCount;
    const nonConflictingChangesResolvedCount = this.nonConflictingChangesResolvedCount;

    const conflictsAllResolved = conflictsCount.lefted === 0 && conflictsCount.resolved === conflictsCount.total;
    const conflictsProgressHint = conflictsAllResolved
      ? localize('merge-conflicts.conflicts.all-resolved')
      : formatLocalize('merge-conflicts.conflicts.partial-resolved', conflictsCount.resolved, conflictsCount.lefted);

    let nonConflictHint = localize('merge-conflicts.merge.type.auto');
    if (nonConflictingChangesResolvedCount.userManualResolveNonConflicts) {
      nonConflictHint = localize('merge-conflicts.merge.type.manual');
    }

    const nonConflictHintInfos = [] as string[];
    if (nonConflictingChangesResolvedCount.total > 0) {
      nonConflictHintInfos.push(
        formatLocalize(
          'merge-conflicts.non-conflicts.progress',
          nonConflictingChangesResolvedCount.total,
          nonConflictHint,
        ),
      );

      const branchInfos = [] as string[];

      if (nonConflictingChangesResolvedCount.left > 0) {
        branchInfos.push(
          formatLocalize('merge-conflicts.non-conflicts.from.left', nonConflictingChangesResolvedCount.left),
        );
      }
      if (nonConflictingChangesResolvedCount.right > 0) {
        branchInfos.push(
          formatLocalize('merge-conflicts.non-conflicts.from.right', nonConflictingChangesResolvedCount.right),
        );
      }
      if (nonConflictingChangesResolvedCount.both > 0) {
        branchInfos.push(
          formatLocalize('merge-conflicts.non-conflicts.from.base', nonConflictingChangesResolvedCount.both),
        );
      }

      if (branchInfos.length > 0) {
        const branchInfoString = branchInfos.join('；');
        nonConflictHintInfos.push(` (${branchInfoString})`);
      }
    }

    const nonConflictHintString = nonConflictHintInfos.join('');

    const mergeInfo = [
      formatLocalize('merge-conflicts.conflicts.summary', conflictsCount.total, conflictsProgressHint),
      conflictsCount.nonConflicts > 0
        ? formatLocalize('merge-conflicts.non-conflicts.summary', conflictsCount.nonConflicts)
        : '',
      nonConflictHintString,
    ]
      .filter(Boolean)
      .join(' | ');

    return mergeInfo;
  }
}
