/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/comparers.ts

import { path, IdleValue } from '@opensumi/ide-utils';

import { IRange } from './types';
const { sep } = path;
const intlFileNameCollator: IdleValue<{ collator: Intl.Collator; collatorIsNumeric: boolean }> = new IdleValue(() => {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return {
    collator,
    collatorIsNumeric: collator.resolvedOptions().numeric,
  };
});

export function compareFileNames(one: string | null, other: string | null, caseSensitive = false): number {
  const a = one || '';
  const b = other || '';
  const result = intlFileNameCollator.getValue().collator.compare(a, b);

  // Using the numeric option in the collator will
  // make compare(`foo1`, `foo01`) === 0. We must disambiguate.
  if (intlFileNameCollator.getValue().collatorIsNumeric && result === 0 && a !== b) {
    return a < b ? -1 : 1;
  }

  return result;
}

function comparePathComponents(one: string, other: string, caseSensitive = false): number {
  if (!caseSensitive) {
    one = one && one.toLowerCase();
    other = other && other.toLowerCase();
  }

  if (one === other) {
    return 0;
  }

  return one < other ? -1 : 1;
}

export function comparePaths(one: string, other: string, caseSensitive = false): number {
  const oneParts = one.split(sep);
  const otherParts = other.split(sep);

  const lastOne = oneParts.length - 1;
  const lastOther = otherParts.length - 1;
  let endOne: boolean;
  let endOther: boolean;

  for (let i = 0; ; i++) {
    endOne = lastOne === i;
    endOther = lastOther === i;

    if (endOne && endOther) {
      return compareFileNames(oneParts[i], otherParts[i], caseSensitive);
    } else if (endOne) {
      return -1;
    } else if (endOther) {
      return 1;
    }

    const result = comparePathComponents(oneParts[i], otherParts[i], caseSensitive);

    if (result !== 0) {
      return result;
    }
  }
}

export function compareAnything(one: string, other: string, lookFor: string): number {
  const elementAName = one.toLowerCase();
  const elementBName = other.toLowerCase();

  // Sort prefix matches over non prefix matches
  const prefixCompare = compareByPrefix(one, other, lookFor);
  if (prefixCompare) {
    return prefixCompare;
  }

  // Sort suffix matches over non suffix matches
  const elementASuffixMatch = elementAName.endsWith(lookFor);
  const elementBSuffixMatch = elementBName.endsWith(lookFor);
  if (elementASuffixMatch !== elementBSuffixMatch) {
    return elementASuffixMatch ? -1 : 1;
  }

  // Understand file names
  const r = compareFileNames(elementAName, elementBName);
  if (r !== 0) {
    return r;
  }

  // Compare by name
  return elementAName.localeCompare(elementBName);
}

export function compareByPrefix(one: string, other: string, lookFor: string): number {
  const elementAName = one.toLowerCase();
  const elementBName = other.toLowerCase();

  // Sort prefix matches over non prefix matches
  const elementAPrefixMatch = elementAName.startsWith(lookFor);
  const elementBPrefixMatch = elementBName.startsWith(lookFor);
  if (elementAPrefixMatch !== elementBPrefixMatch) {
    return elementAPrefixMatch ? -1 : 1;
  } else if (elementAPrefixMatch && elementBPrefixMatch) {
    // Same prefix: Sort shorter matches to the top to have those on top that match more precisely
    if (elementAName.length < elementBName.length) {
      return -1;
    }

    if (elementAName.length > elementBName.length) {
      return 1;
    }
  }

  return 0;
}

export function compareRangesUsingStarts(a: IRange | null | undefined, b: IRange | null | undefined): number {
  if (a && b) {
    const aStartLineNumber = a.startLineNumber | 0;
    const bStartLineNumber = b.startLineNumber | 0;

    if (aStartLineNumber === bStartLineNumber) {
      const aStartColumn = a.startColumn | 0;
      const bStartColumn = b.startColumn | 0;

      if (aStartColumn === bStartColumn) {
        const aEndLineNumber = a.endLineNumber | 0;
        const bEndLineNumber = b.endLineNumber | 0;

        if (aEndLineNumber === bEndLineNumber) {
          const aEndColumn = a.endColumn | 0;
          const bEndColumn = b.endColumn | 0;
          return aEndColumn - bEndColumn;
        }
        return aEndLineNumber - bEndLineNumber;
      }
      return aStartColumn - bStartColumn;
    }
    return aStartLineNumber - bStartLineNumber;
  }
  const aExists = a ? 1 : 0;
  const bExists = b ? 1 : 0;
  return aExists - bExists;
}
