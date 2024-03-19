import { Event, Uri } from '@opensumi/ide-core-common';

import { ISCMActionButtonDescriptor } from './scm';

export interface ISCMHistoryProvider {
  readonly onDidChangeActionButton: Event<void>;
  readonly onDidChangeCurrentHistoryItemGroup: Event<void>;

  get actionButton(): ISCMActionButtonDescriptor | undefined;
  set actionButton(button: ISCMActionButtonDescriptor | undefined);

  get currentHistoryItemGroup(): ISCMHistoryItemGroup | undefined;
  set currentHistoryItemGroup(historyItemGroup: ISCMHistoryItemGroup | undefined);

  provideHistoryItems(historyItemGroupId: string, options: ISCMHistoryOptions): Promise<ISCMHistoryItem[] | undefined>;
  provideHistoryItemChanges(historyItemId: string): Promise<ISCMHistoryItemChange[] | undefined>;
  resolveHistoryItemGroupBase(historyItemGroupId: string): Promise<ISCMHistoryItemGroup | undefined>;
  resolveHistoryItemGroupCommonAncestor(
    historyItemGroupId1: string,
    historyItemGroupId2: string,
  ): Promise<{ id: string; ahead: number; behind: number } | undefined>;
}

export interface ISCMHistoryOptions {
  readonly cursor?: string;
  readonly limit?: number | { id?: string };
}

export interface ISCMHistoryItemGroup {
  readonly id: string;
  readonly label: string;
  readonly upstream?: ISCMRemoteHistoryItemGroup;
}

export interface ISCMRemoteHistoryItemGroup {
  readonly id: string;
  readonly label: string;
}

export interface ISCMHistoryItem {
  readonly id: string;
  readonly parentIds: string[];
  readonly label: string;
  readonly description?: string;
  readonly icon?: Uri | { light: Uri; dark: Uri };
  readonly timestamp?: number;
}

export interface ISCMHistoryItemChange {
  readonly uri: Uri;
  readonly originalUri?: Uri;
  readonly modifiedUri?: Uri;
  readonly renameUri?: Uri;
}
