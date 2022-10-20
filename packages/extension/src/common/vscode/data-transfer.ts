/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Modified from https://github.com/microsoft/vscode/blob/f86ceb6749721ca068f0407914521ad11ca704a8/src/vs/base/common/dataTransfer.ts

import { Mimes, parse, Uri as URI, uuid } from '@opensumi/ide-core-common';

export const CodeDataTransfers = {
  EDITORS: 'CodeEditors',
  FILES: 'CodeFiles',
};

export interface IDataTransferFile {
  readonly name: string;
  readonly uri?: URI;
  data(): Promise<Uint8Array>;
}

export interface IDataTransferItem {
  readonly id: string;
  asString(): Thenable<string>;
  asFile(): IDataTransferFile | undefined;
  value: any;
}

export function createStringDataTransferItem(stringOrPromise: string | Promise<string>): IDataTransferItem {
  return {
    id: uuid(),
    asString: async () => stringOrPromise,
    asFile: () => undefined,
    value: typeof stringOrPromise === 'string' ? stringOrPromise : undefined,
  };
}

export function createFileDataTransferItem(
  fileName: string,
  uri: URI | undefined,
  data: () => Promise<Uint8Array>,
): IDataTransferItem {
  return {
    id: uuid(),
    asString: async () => '',
    asFile: () => ({ name: fileName, uri, data }),
    value: undefined,
  };
}

export class VSDataTransfer {
  private readonly _entries = new Map<string, IDataTransferItem[]>();

  public get size(): number {
    return this._entries.size;
  }

  public has(mimeType: string): boolean {
    return this._entries.has(this.toKey(mimeType));
  }

  public get(mimeType: string): IDataTransferItem | undefined {
    return this._entries.get(this.toKey(mimeType))?.[0];
  }

  public append(mimeType: string, value: IDataTransferItem): void {
    const existing = this._entries.get(mimeType);
    if (existing) {
      existing.push(value);
    } else {
      this._entries.set(this.toKey(mimeType), [value]);
    }
  }

  public replace(mimeType: string, value: IDataTransferItem): void {
    this._entries.set(this.toKey(mimeType), [value]);
  }

  public delete(mimeType: string) {
    this._entries.delete(this.toKey(mimeType));
  }

  public *entries(): Iterable<[string, IDataTransferItem]> {
    for (const [mine, items] of this._entries.entries()) {
      for (const item of items) {
        yield [mine, item];
      }
    }
  }

  public values(): Iterable<IDataTransferItem> {
    return Array.from(this._entries.values()).flat();
  }

  public forEach(f: (value: IDataTransferItem, key: string) => void) {
    for (const [mime, item] of this.entries()) {
      f(item, mime);
    }
  }

  private toKey(mimeType: string): string {
    return mimeType.toLowerCase();
  }
}

export const DataTransfers = {
  /**
   * Application specific resource transfer type
   */
  RESOURCES: 'ResourceURLs',

  /**
   * Browser specific transfer type to download
   */
  DOWNLOAD_URL: 'DownloadURL',

  /**
   * Browser specific transfer type for files
   */
  FILES: 'Files',

  /**
   * Typically transfer type for copy/paste transfers.
   */
  TEXT: Mimes.text,
};

export class DraggedTreeItemsIdentifier {
  constructor(readonly identifier: string) {}
}

/**
 * A singleton to store transfer data during drag & drop operations that are only valid within the application.
 */
export class LocalSelectionTransfer<T> {
  private static readonly INSTANCE = new LocalSelectionTransfer();

  private data?: T[];
  private proto?: T;

  private constructor() {
    // protect against external instantiation
  }

  static getInstance<T>(): LocalSelectionTransfer<T> {
    return LocalSelectionTransfer.INSTANCE as LocalSelectionTransfer<T>;
  }

  hasData(proto: T): boolean {
    return proto && proto === this.proto;
  }

  clearData(proto: T): void {
    if (this.hasData(proto)) {
      this.proto = undefined;
      this.data = undefined;
    }
  }

  getData(proto: T): T[] | undefined {
    if (this.hasData(proto)) {
      return this.data;
    }

    return undefined;
  }

  setData(data: T[], proto: T): void {
    if (proto) {
      this.data = data;
      this.proto = proto;
    }
  }
}

/** Used to hold the data that is being dragged during a drag and drop operation. It may hold one or more data items, each of one or more data types. For more information about drag and drop, see HTML Drag and Drop API. */
interface DataTransfer {
  /**
   * Returns the kind of operation that is currently selected. If the kind of operation isn't one of those that is allowed by the effectAllowed attribute, then the operation will fail.
   *
   * Can be set, to change the selected operation.
   *
   * The possible values are "none", "copy", "link", and "move".
   */
  dropEffect: 'none' | 'copy' | 'link' | 'move';
  /**
   * Returns the kinds of operations that are to be allowed.
   *
   * Can be set (during the dragstart event), to change the allowed operations.
   *
   * The possible values are "none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all", and "uninitialized",
   */
  effectAllowed: 'none' | 'copy' | 'copyLink' | 'copyMove' | 'link' | 'linkMove' | 'move' | 'all' | 'uninitialized';
  /** Returns a FileList of the files being dragged, if any. */
  readonly files: FileList;
  /** Returns a DataTransferItemList object, with the drag data. */
  readonly items: DataTransferItemList;
  /** Returns a frozen array listing the formats that were set in the dragstart event. In addition, if any files are being dragged, then one of the types will be the string "Files". */
  readonly types: ReadonlyArray<string>;
  /** Removes the data of the specified formats. Removes all data if the argument is omitted. */
  clearData(format?: string): void;
  /** Returns the specified data. If there is no such data, returns the empty string. */
  getData(format: string): string;
  /** Adds the specified data. */
  setData(format: string, data: string): void;
  /** Uses the given element to update the drag feedback, replacing any previously specified feedback. */
  setDragImage(image: Element, x: number, y: number): void;
}

export interface FileAdditionalNativeProperties {
  /**
   * The real path to the file on the users filesystem. Only available on electron.
   */
  readonly path?: string;
}

export function createFileDataTransferItemFromFile(file: File): IDataTransferItem {
  const uri = (file as FileAdditionalNativeProperties).path
    ? URI.parse((file as FileAdditionalNativeProperties).path!)
    : undefined;
  return createFileDataTransferItem(file.name, uri, async () => new Uint8Array(await file.arrayBuffer()));
}

export function toVSDataTransfer(dataTransfer: DataTransfer) {
  const vsDataTransfer = new VSDataTransfer();
  for (const item of dataTransfer.items as any) {
    const type = item.type;
    if (item.kind === 'string') {
      const asStringValue = new Promise<string>((resolve) => item.getAsString(resolve));
      vsDataTransfer.append(type, createStringDataTransferItem(asStringValue));
    } else if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        vsDataTransfer.append(type, createFileDataTransferItemFromFile(file));
      }
    }
  }
  return vsDataTransfer;
}
