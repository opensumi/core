/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Word inside a model.
 */
export interface IWordAtPosition {
  /**
	 * The word.
	 */
  readonly word: string;
  /**
	 * The column where the word starts.
	 */
  readonly startColumn: number;
  /**
	 * The column where the word ends.
	 */
  readonly endColumn: number;
}

export const USUAL_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

/**
 * Create a word definition regular expression based on default word separators.
 * Optionally provide allowed separators that should be included in words.
 *
 * The default would look like this:
 * /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
 */
function createWordRegExp(allowInWords: string = ''): RegExp {
  let source = '(-?\\d*\\.\\d\\w*)|([^';
  for (const sep of USUAL_WORD_SEPARATORS) {
    if (allowInWords.indexOf(sep) >= 0) {
      continue;
    }
    source += '\\' + sep;
  }
  source += '\\s]+)';
  return new RegExp(source, 'g');
}

// catches numbers (including floating numbers) in the first group, and alphanum in the second
export const DEFAULT_WORD_REGEXP = createWordRegExp();

export function ensureValidWordDefinition(wordDefinition?: RegExp | null): RegExp {
  let result: RegExp = DEFAULT_WORD_REGEXP;

  if (wordDefinition && (wordDefinition instanceof RegExp)) {
    if (!wordDefinition.global) {
      let flags = 'g';
      if (wordDefinition.ignoreCase) {
        flags += 'i';
      }
      if (wordDefinition.multiline) {
        flags += 'm';
      }
      if ((wordDefinition as any).unicode) {
        flags += 'u';
      }
      result = new RegExp(wordDefinition.source, flags);
    } else {
      result = wordDefinition;
    }
  }

  result.lastIndex = 0;

  return result;
}

function getWordAtPosFast(column: number, wordDefinition: RegExp, text: string, textOffset: number): IWordAtPosition | null {
  // find whitespace enclosed text around column and match from there

  const pos = column - 1 - textOffset;
  const start = text.lastIndexOf(' ', pos - 1) + 1;

  wordDefinition.lastIndex = start;
  let match: RegExpMatchArray | null;
  while (match = wordDefinition.exec(text)) {
    const matchIndex = match.index || 0;
    if (matchIndex <= pos && wordDefinition.lastIndex >= pos) {
      return {
        word: match[0],
        startColumn: textOffset + 1 + matchIndex,
        endColumn: textOffset + 1 + wordDefinition.lastIndex,
      };
    }
  }

  return null;
}

function getWordAtPosSlow(column: number, wordDefinition: RegExp, text: string, textOffset: number): IWordAtPosition | null {
  // matches all words starting at the beginning
  // of the input until it finds a match that encloses
  // the desired column. slow but correct

  const pos = column - 1 - textOffset;
  wordDefinition.lastIndex = 0;

  let match: RegExpMatchArray | null;
  while (match = wordDefinition.exec(text)) {
    const matchIndex = match.index || 0;
    if (matchIndex > pos) {
      // |nW -> matched only after the pos
      return null;

    } else if (wordDefinition.lastIndex >= pos) {
      // W|W -> match encloses pos
      return {
        word: match[0],
        startColumn: textOffset + 1 + matchIndex,
        endColumn: textOffset + 1 + wordDefinition.lastIndex,
      };
    }
  }

  return null;
}

export function getWordAtText(column: number, wordDefinition: RegExp, text: string, textOffset: number): IWordAtPosition | null {

  // if `words` can contain whitespace character we have to use the slow variant
  // otherwise we use the fast variant of finding a word
  wordDefinition.lastIndex = 0;
  const match = wordDefinition.exec(text);
  if (!match) {
    return null;
  }
  // todo@joh the `match` could already be the (first) word
  const ret = match[0].indexOf(' ') >= 0
    // did match a word which contains a space character -> use slow word find
    ? getWordAtPosSlow(column, wordDefinition, text, textOffset)
    // sane word definition -> use fast word find
    : getWordAtPosFast(column, wordDefinition, text, textOffset);

  // both (getWordAtPosFast and getWordAtPosSlow) leave the wordDefinition-RegExp
  // in an undefined state and to not confuse other users of the wordDefinition
  // we reset the lastIndex
  wordDefinition.lastIndex = 0;

  return ret;
}
