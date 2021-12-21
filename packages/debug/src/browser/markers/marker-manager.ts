/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/markers/src/browser/marker-manager.ts

import { Injectable, Autowired } from '@opensumi/di';
import { Event, Emitter, URI } from '@opensumi/ide-core-browser';
import { FileChangeEvent, FileChangeType } from '@opensumi/ide-file-service';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { Marker } from './marker';

/*
 * findMarkers方法的参数
 */
export interface SearchFilter<D> {
  uri?: URI;
  owner?: string;
  dataFilter?: (data: D) => boolean;
}

export class MarkerCollection<T> {
  protected readonly owner2Markers = new Map<string, Readonly<Marker<T>>[]>();

  constructor(public readonly uri: URI, public readonly kind: string) {}

  get empty(): boolean {
    return !this.owner2Markers.size;
  }

  getOwners(): string[] {
    return Array.from(this.owner2Markers.keys());
  }

  getMarkers(owner: string): Readonly<Marker<T>>[] {
    return this.owner2Markers.get(owner) || [];
  }

  setMarkers(owner: string, markerData: T[]): Marker<T>[] {
    const before = this.owner2Markers.get(owner);
    if (markerData.length > 0) {
      this.owner2Markers.set(
        owner,
        markerData.map((data) => this.createMarker(owner, data)),
      );
    } else {
      this.owner2Markers.delete(owner);
    }
    return before || [];
  }

  protected createMarker(owner: string, data: T): Readonly<Marker<T>> {
    return Object.freeze({
      uri: this.uri.toString(),
      kind: this.kind,
      owner,
      data,
    });
  }

  findMarkers(filter: SearchFilter<T>): Marker<T>[] {
    if (filter.owner) {
      if (this.owner2Markers.has(filter.owner)) {
        return this.filterMarkers(filter, this.owner2Markers.get(filter.owner));
      }
      return [];
    } else {
      const result: Marker<T>[] = [];
      for (const markers of this.owner2Markers.values()) {
        result.push(...this.filterMarkers(filter, markers));
      }
      return result;
    }
  }

  protected filterMarkers(filter: SearchFilter<T>, toFilter?: Marker<T>[]) {
    if (!toFilter) {
      return [];
    }
    if (filter.dataFilter) {
      return toFilter.filter((d) => filter.dataFilter && filter.dataFilter(d.data));
    } else {
      return toFilter;
    }
  }
}

export interface Uri2MarkerEntry {
  uri: string;
  markers: Owner2MarkerEntry[];
}

export interface Owner2MarkerEntry {
  owner: string;
  markerData: object[];
}

@Injectable()
export abstract class MarkerManager<D extends object> {
  public abstract getKind(): string;

  protected readonly uri2MarkerCollection = new Map<string, MarkerCollection<D>>();
  protected readonly onDidChangeMarkersEmitter = new Emitter<URI>();

  @Autowired(IFileServiceClient) protected fileService: IFileServiceClient;

  constructor() {
    this.init();
  }

  protected init(): void {
    this.fileService.onFilesChanged((event) => {
      const relevantEvent = event.filter(({ type }) => type === FileChangeType.DELETED);
      if (relevantEvent.length) {
        this.cleanMarkers(relevantEvent);
      }
    });
  }

  protected cleanMarkers(event: FileChangeEvent): void {
    for (const uriString of this.uri2MarkerCollection.keys()) {
      const uri = new URI(uriString);
      if (FileChangeEvent.isDeleted(event, uri)) {
        this.cleanAllMarkers(uri);
      }
    }
  }

  get onDidChangeMarkers(): Event<URI> {
    return this.onDidChangeMarkersEmitter.event;
  }

  protected fireOnDidChangeMarkers(uri: URI): void {
    this.onDidChangeMarkersEmitter.fire(uri);
  }

  /*
   * 替换遮罩元素属性
   */
  setMarkers(uri: URI, owner: string, data: D[]): Marker<D>[] {
    const uriString = uri.toString();
    const collection = this.uri2MarkerCollection.get(uriString) || new MarkerCollection<D>(uri, this.getKind());
    const oldMarkers = collection.setMarkers(owner, data);
    if (collection.empty) {
      this.uri2MarkerCollection.delete(uri.toString());
    } else {
      this.uri2MarkerCollection.set(uriString, collection);
    }
    this.fireOnDidChangeMarkers(uri);
    return oldMarkers;
  }

  /*
   * 根据filter函数返回所有断点
   */
  findMarkers(filter: SearchFilter<D> = {}): Marker<D>[] {
    if (filter.uri) {
      const collection = this.uri2MarkerCollection.get(filter.uri.toString());
      return collection ? collection.findMarkers(filter) : [];
    }
    const result: Marker<D>[] = [];
    for (const uri of this.getUris()) {
      const filters = this.uri2MarkerCollection.get(uri)?.findMarkers(filter);
      if (filters) {
        result.push(...filters);
      }
    }
    return result;
  }

  getUris(): IterableIterator<string> {
    return this.uri2MarkerCollection.keys();
  }

  cleanAllMarkers(uri?: URI): void {
    if (uri) {
      this.doCleanAllMarkers(uri);
    } else {
      for (const uriString of this.getUris()) {
        this.doCleanAllMarkers(new URI(uriString));
      }
    }
  }
  protected doCleanAllMarkers(uri: URI): void {
    const uriString = uri.toString();
    const collection = this.uri2MarkerCollection.get(uriString);
    if (collection !== undefined) {
      this.uri2MarkerCollection.delete(uriString);
      this.fireOnDidChangeMarkers(uri);
    }
  }
}
