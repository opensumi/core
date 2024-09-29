/** ******************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/filesystem/src/node/file-change-collection.ts

import debounce from 'lodash/debounce';

import { Injectable } from '@opensumi/di';
import { DefaultMap, Dispatcher, FileUri } from '@opensumi/ide-utils';

import { FileChange, FileChangeType } from '../common';

/**
 * A file change collection guarantees that only one change is reported for each URI.
 *
 * Changes are normalized according following rules:
 * - ADDED + ADDED => ADDED
 * - ADDED + UPDATED => ADDED
 * - ADDED + DELETED => NONE
 * - UPDATED + ADDED => UPDATED
 * - UPDATED + UPDATED => UPDATED
 * - UPDATED + DELETED => DELETED
 * - DELETED + ADDED => UPDATED
 * - DELETED + UPDATED => UPDATED
 * - DELETED + DELETED => DELETED
 */
export class FileChangeCollection {
  protected readonly changes = new Map<string, FileChange>();

  push(change: FileChange): void {
    const current = this.changes.get(change.uri);
    if (current) {
      if (this.isDeleted(current, change)) {
        this.changes.delete(change.uri);
      } else if (this.isUpdated(current, change)) {
        current.type = FileChangeType.UPDATED;
      } else if (!this.shouldSkip(current, change)) {
        current.type = change.type;
      }
    } else {
      this.changes.set(change.uri, change);
    }
  }

  protected isDeleted(current: FileChange, change: FileChange): boolean {
    return current.type === FileChangeType.ADDED && change.type === FileChangeType.DELETED;
  }

  protected isUpdated(current: FileChange, change: FileChange): boolean {
    return current.type === FileChangeType.DELETED && change.type === FileChangeType.ADDED;
  }

  protected shouldSkip(current: FileChange, change: FileChange): boolean {
    return (
      (current.type === FileChangeType.ADDED && change.type === FileChangeType.UPDATED) ||
      (current.type === FileChangeType.UPDATED && change.type === FileChangeType.ADDED)
    );
  }

  values(): FileChange[] {
    return Array.from(this.changes.values());
  }

  reset(): void {
    this.changes.clear();
  }
}

@Injectable()
export class FileChangeCollectionManager {
  private _onFileChangeEmitter = new Dispatcher<FileChange[]>();
  public readonly onFileChange = (watcherId: number, cb: (change: FileChange[]) => void) =>
    this._onFileChangeEmitter.on(String(watcherId))(cb);

  protected changes = new DefaultMap<number, FileChangeCollection>(() => new FileChangeCollection());

  /**
   * Fires file changes to clients.
   * It is debounced in the case if the filesystem is spamming to avoid overwhelming clients with events.
   */
  protected readonly fireDidFilesChanged: () => void = debounce(() => this.doFireDidFilesChanged(), 100);
  protected doFireDidFilesChanged(): void {
    this.changes.forEach((change, watcherId) => {
      const data = change.values();
      change.reset();

      this._onFileChangeEmitter.dispatch(String(watcherId), data);
    });
  }

  pushAdded(watcherId: number, path: string): void {
    this.pushFileChange(watcherId, path, FileChangeType.ADDED);
  }

  pushUpdated(watcherId: number, path: string): void {
    this.pushFileChange(watcherId, path, FileChangeType.UPDATED);
  }

  pushDeleted(watcherId: number, path: string): void {
    this.pushFileChange(watcherId, path, FileChangeType.DELETED);
  }

  protected pushFileChange(watcherId: number, path: string, type: FileChangeType): void {
    const uri = FileUri.create(path).toString();
    this.changes.get(watcherId).push({ uri, type });

    this.fireDidFilesChanged();
  }
}
