/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/editor/common/core/characterClassifier.ts

import { toUint8 } from './uint';

/**
 * A fast character classifier that uses a compact array for ASCII values.
 */
export class CharacterClassifier<T extends number> {
  /**
   * Maintain a compact (fully initialized ASCII map for quickly classifying ASCII characters - used more often in code).
   */
  protected _asciiMap: Uint8Array;

  /**
   * The entire map (sparse array).
   */
  protected _map: Map<number, number>;

  protected _defaultValue: number;

  constructor(_defaultValue: T) {
    const defaultValue = toUint8(_defaultValue);

    this._defaultValue = defaultValue;
    this._asciiMap = CharacterClassifier._createAsciiMap(defaultValue);
    this._map = new Map<number, number>();
  }

  private static _createAsciiMap(defaultValue: number): Uint8Array {
    const asciiMap: Uint8Array = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      asciiMap[i] = defaultValue;
    }
    return asciiMap;
  }

  public set(charCode: number, _value: T): void {
    const value = toUint8(_value);

    if (charCode >= 0 && charCode < 256) {
      this._asciiMap[charCode] = value;
    } else {
      this._map.set(charCode, value);
    }
  }

  public get(charCode: number): T {
    if (charCode >= 0 && charCode < 256) {
      return this._asciiMap[charCode] as T;
    } else {
      return (this._map.get(charCode) || this._defaultValue) as T;
    }
  }
}

const enum EBoolean {
  False = 0,
  True = 1,
}

export class CharacterSet {
  // "Boolean" is not that "Boolean" primitive type in TypeScript.
  // eslint-disable-next-line @typescript-eslint/ban-types
  private readonly _actual: CharacterClassifier<EBoolean>;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/ban-types
    this._actual = new CharacterClassifier<EBoolean>(EBoolean.False);
  }

  public add(charCode: number): void {
    this._actual.set(charCode, EBoolean.True);
  }

  public has(charCode: number): boolean {
    return this._actual.get(charCode) === EBoolean.True;
  }
}
