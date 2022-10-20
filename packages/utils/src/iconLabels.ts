/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from  https://github.com/microsoft/vscode/blob/main/src/vs/base/common/iconLabels.ts

import { matchesFuzzy } from './filters';
import { ltrim } from './strings';

export const iconStartMarker = '$(';

const iconNameCharacterRegexp = new RegExp('[A-Za-z0-9~-]');

export interface IParsedLabelWithIcons {
  readonly text: string;
  readonly iconOffsets?: readonly number[];
}

export function parseLabelWithIcons(text: string): IParsedLabelWithIcons {
  const firstIconIndex = text.indexOf(iconStartMarker);
  if (firstIconIndex === -1) {
    return { text }; // return early if the word does not include an icon
  }

  return doParseLabelWithIcons(text, firstIconIndex);
}

function doParseLabelWithIcons(text: string, firstIconIndex: number): IParsedLabelWithIcons {
  const iconOffsets: number[] = [];
  let textWithoutIcons = '';

  function appendChars(chars: string) {
    if (chars) {
      textWithoutIcons += chars;

      for (const _ of chars) {
        iconOffsets.push(iconsOffset); // make sure to fill in icon offsets
      }
    }
  }

  let currentIconStart = -1;
  let currentIconValue = '';
  let iconsOffset = 0;

  let char: string;
  let nextChar: string;

  let offset = firstIconIndex;
  const length = text.length;

  // Append all characters until the first icon
  appendChars(text.substr(0, firstIconIndex));

  // example: $(file-symlink-file) my cool $(other-icon) entry
  while (offset < length) {
    char = text[offset];
    nextChar = text[offset + 1];

    // beginning of icon: some value $( <--
    if (char === iconStartMarker[0] && nextChar === iconStartMarker[1]) {
      currentIconStart = offset;

      // if we had a previous potential icon value without
      // the closing ')', it was actually not an icon and
      // so we have to add it to the actual value
      appendChars(currentIconValue);

      currentIconValue = iconStartMarker;

      offset++; // jump over '('
    }

    // end of icon: some value $(some-icon) <--
    else if (char === ')' && currentIconStart !== -1) {
      const currentIconLength = offset - currentIconStart + 1; // +1 to include the closing ')'
      iconsOffset += currentIconLength;
      currentIconStart = -1;
      currentIconValue = '';
    }

    // within icon
    else if (currentIconStart !== -1) {
      // Make sure this is a real icon name
      if (iconNameCharacterRegexp.test(char)) {
        currentIconValue += char;
      } else {
        // This is not a real icon, treat it as text
        appendChars(currentIconValue);

        currentIconStart = -1;
        currentIconValue = '';
      }
    }

    // any value outside of icon
    else {
      appendChars(char);
    }

    offset++;
  }

  // if we had a previous potential icon value without
  // the closing ')', it was actually not an icon and
  // so we have to add it to the actual value
  appendChars(currentIconValue);

  return { text: textWithoutIcons, iconOffsets };
}

export function matchesFuzzyIconAware(
  query: string,
  target: IParsedLabelWithIcons,
  enableSeparateSubstringMatching = false,
):
  | {
      start: number;
      end: number;
    }[]
  | null {
  const { text, iconOffsets } = target;

  // Return early if there are no icon markers in the word to match against
  if (!iconOffsets || iconOffsets.length === 0) {
    return matchesFuzzy(query, text, enableSeparateSubstringMatching);
  }

  // Trim the word to match against because it could have leading
  // whitespace now if the word started with an icon
  const wordToMatchAgainstWithoutIconsTrimmed = ltrim(text, ' ');
  const leadingWhitespaceOffset = text.length - wordToMatchAgainstWithoutIconsTrimmed.length;

  // match on value without icon
  const matches = matchesFuzzy(query, wordToMatchAgainstWithoutIconsTrimmed, enableSeparateSubstringMatching);

  // Map matches back to offsets with icon and trimming
  if (matches) {
    for (const match of matches) {
      const iconOffset =
        iconOffsets[match.start + leadingWhitespaceOffset] /* icon offsets at index */ +
        leadingWhitespaceOffset; /* overall leading whitespace offset */
      match.start += iconOffset;
      match.end += iconOffset;
    }
  }

  return matches;
}
