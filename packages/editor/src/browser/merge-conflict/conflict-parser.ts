/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/extensions/merge-conflict/src/mergeConflictParser.ts

import { Injectable } from '@opensumi/di';
import { Disposable, LRUCache, uuid } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';

import { ICacheDocumentMergeConflict, IDocumentMergeConflictDescriptor, IMergeRegion } from './types';

const startHeaderMarker = '<<<<<<<';
const commonAncestorsMarker = '|||||||';
const splitterMarker = '=======';
const endFooterMarker = '>>>>>>>';

interface IScanMergedConflict {
  startHeader: TextLine;
  commonAncestors: TextLine[];
  splitter?: TextLine;
  endFooter?: TextLine;
}

export interface IConflictCache {
  id: string;
  range: monaco.Range;
  text: string;
  isResolved: boolean;
}

export class TextLine {
  lineNumber: number;
  text: string;
  range: monaco.Range;
  rangeIncludingLineBreak: monaco.Range;
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
  constructor(document: monaco.editor.ITextModel, line: number) {
    if (typeof line !== 'number' || line <= 0 || line > document.getLineCount()) {
      throw new Error('Illegal value for `line`');
    }
    this.text = document.getLineContent(line);
    this.firstNonWhitespaceCharacterIndex = /^(\s*)/.exec(this.text)![1].length;
    this.range = new monaco.Range(line, 1, line, this.text.length + 1);
    this.rangeIncludingLineBreak =
      line <= document.getLineCount() ? new monaco.Range(line, 1, line + 1, 1) : this.range;
    this.lineNumber = line;
    this.isEmptyOrWhitespace = this.firstNonWhitespaceCharacterIndex === this.text.length;
  }
}

@Injectable()
export class MergeConflictParser extends Disposable {
  cache = new LRUCache<string, DocumentMergeConflict[]>(100);

  private _conflictTextCaches = new Map<string, string>();

  private _conflictRangeCaches = new Map<string, IConflictCache[]>();

  private static createCacheKey(document: monaco.editor.ITextModel) {
    return `${document.uri.toString()}-${document.getVersionId()}`;
  }

  scanDocument(document: monaco.editor.ITextModel) {
    const cacheKey = MergeConflictParser.createCacheKey(document);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Scan each line in the document, we already know there is at least a <<<<<<< and
    // >>>>>> marker within the document, we need to group these into conflict ranges.
    // We initially build a scan match, that references the lines of the header, splitter
    // and footer. This is then converted into a full descriptor containing all required
    // ranges.

    let currentConflict: IScanMergedConflict | null = null;
    const conflictDescriptors: IDocumentMergeConflictDescriptor[] = [];
    const cacheConflictDescriptors = this._conflictTextCaches.get(document.uri.toString());

    for (let i = 0; i < document.getLineCount(); i++) {
      const line = new TextLine(document, i + 1);
      // Ignore empty lines
      if (!line || line.isEmptyOrWhitespace) {
        continue;
      }

      // Is this a start line? <<<<<<<
      if (line.text.startsWith(startHeaderMarker)) {
        if (currentConflict !== null) {
          // Error, we should not see a startMarker before we've seen an endMarker
          currentConflict = null;

          // Give up parsing, anything matched up this to this point will be decorated
          // anything after will not
          break;
        }

        // Create a new conflict starting at this line
        currentConflict = { startHeader: line, commonAncestors: [] };
      }
      // Are we within a conflict block and is this a common ancestors marker? |||||||
      else if (currentConflict && !currentConflict.splitter && line.text.startsWith(commonAncestorsMarker)) {
        currentConflict.commonAncestors.push(line);
      }
      // Are we within a conflict block and is this a splitter? =======
      else if (currentConflict && !currentConflict.splitter && line.text === splitterMarker) {
        currentConflict.splitter = line;
      }
      // Are we within a conflict block and is this a footer? >>>>>>>
      else if (currentConflict && line.text.startsWith(endFooterMarker)) {
        currentConflict.endFooter = line;

        // Create a full descriptor from the lines that we matched. This can return
        // null if the descriptor could not be completed.
        const completeDescriptor = scanItemToMergeConflictDescriptor(document, currentConflict);

        if (completeDescriptor !== null) {
          conflictDescriptors.push(completeDescriptor);
        }

        // Reset the current conflict to be empty, so we can match the next
        // starting header marker.
        currentConflict = null;
      }
    }
    if (!cacheConflictDescriptors && conflictDescriptors.length) {
      this._conflictTextCaches.set(document.uri.toString(), document.getValue());
      const conflictRanges: IConflictCache[] = [];
      conflictDescriptors.filter(Boolean).forEach((descriptor) => {
        const range = descriptor.range;
        conflictRanges.push({
          id: uuid(),
          range,
          text: document.getValueInRange(range),
          isResolved: false,
        });
      });
      this._conflictRangeCaches.set(document.uri.toString(), conflictRanges);
    }

    const result = conflictDescriptors?.filter(Boolean).map((descriptor) => new DocumentMergeConflict(descriptor));
    this.cache.set(cacheKey, result);

    return result;
  }
  getConflictText(uri: string) {
    return this._conflictTextCaches.get(uri);
  }
  getAllConflictsByUri(uri: string) {
    return this._conflictRangeCaches.get(uri);
  }

  getAllConflicts() {
    return this._conflictRangeCaches;
  }

  setConflictResolved(uri: string, id: string) {
    const conflictRanges = this._conflictRangeCaches.get(uri);
    if (conflictRanges) {
      const conflictRange = conflictRanges.find((item) => item.id === id);
      if (conflictRange) {
        conflictRange.isResolved = true;
      }
    }
  }

  deleteConflictText(uri: string) {
    this._conflictTextCaches.delete(uri);
  }
  dispose() {
    this._conflictTextCaches.clear();
    this._conflictRangeCaches.clear();
  }
}

function scanItemToMergeConflictDescriptor(
  document: monaco.editor.ITextModel,
  scanned: IScanMergedConflict,
): IDocumentMergeConflictDescriptor | null {
  // Validate we have all the required lines within the scan item.
  if (!scanned.startHeader || !scanned.splitter || !scanned.endFooter) {
    return null;
  }

  const tokenAfterCurrentBlock: TextLine = scanned.commonAncestors[0] || scanned.splitter;

  // Assume that descriptor.current.header, descriptor.incoming.header and descriptor.splitter
  // have valid ranges, fill in content and total ranges from these parts.
  // NOTE: We need to shift the decorator range back one character so the splitter does not end up with
  // two decoration colors (current and splitter), if we take the new line from the content into account
  // the decorator will wrap to the next line.
  return {
    current: {
      header: scanned.startHeader.range,
      decoratorContent: new monaco.Range(
        scanned.startHeader.rangeIncludingLineBreak.endLineNumber,
        scanned.startHeader.rangeIncludingLineBreak.endColumn,
        shiftBackOneCharacter(
          document,
          tokenAfterCurrentBlock.range.getStartPosition(),
          scanned.startHeader.rangeIncludingLineBreak.getEndPosition(),
        ).lineNumber,
        shiftBackOneCharacter(
          document,
          tokenAfterCurrentBlock.range.getStartPosition(),
          scanned.startHeader.rangeIncludingLineBreak.getEndPosition(),
        ).column,
      ),
      // Current content is range between header (shifted for linebreak) and splitter or common ancestors mark start
      content: new monaco.Range(
        scanned.startHeader.rangeIncludingLineBreak.endLineNumber,
        scanned.startHeader.rangeIncludingLineBreak.endColumn,
        tokenAfterCurrentBlock.range.startLineNumber,
        tokenAfterCurrentBlock.range.startColumn,
      ),
      name: scanned.startHeader.text.substring(startHeaderMarker.length + 1),
    },
    commonAncestors: scanned.commonAncestors.map((currentTokenLine, index, commonAncestors) => {
      const nextTokenLine = commonAncestors[index + 1] || scanned.splitter;
      return {
        header: currentTokenLine.range,
        decoratorContent: new monaco.Range(
          currentTokenLine.rangeIncludingLineBreak.endLineNumber,
          currentTokenLine.rangeIncludingLineBreak.endColumn,

          shiftBackOneCharacter(
            document,
            nextTokenLine.range.getStartPosition(),
            currentTokenLine.rangeIncludingLineBreak.getEndPosition(),
          ).lineNumber,
          shiftBackOneCharacter(
            document,
            nextTokenLine.range.getStartPosition(),
            currentTokenLine.rangeIncludingLineBreak.getEndPosition(),
          ).lineNumber,
        ),
        // Each common ancestors block is range between one common ancestors token
        // (shifted for linebreak) and start of next common ancestors token or splitter
        content: new monaco.Range(
          currentTokenLine.rangeIncludingLineBreak.endLineNumber,
          currentTokenLine.rangeIncludingLineBreak.endColumn,
          nextTokenLine.range.startLineNumber,
          nextTokenLine.range.startColumn,
        ),
        name: currentTokenLine.text.substring(commonAncestorsMarker.length + 1),
      };
    }),
    splitter: scanned.splitter.range,
    incoming: {
      header: scanned.endFooter.range,
      decoratorContent: new monaco.Range(
        scanned.splitter.rangeIncludingLineBreak.endLineNumber,
        scanned.splitter.rangeIncludingLineBreak.endColumn,
        shiftBackOneCharacter(
          document,
          scanned.endFooter.range.getStartPosition(),
          scanned.splitter.rangeIncludingLineBreak.getEndPosition(),
        ).lineNumber,
        shiftBackOneCharacter(
          document,
          scanned.endFooter.range.getStartPosition(),
          scanned.splitter.rangeIncludingLineBreak.getEndPosition(),
        ).column,
      ),
      // Incoming content is range between splitter (shifted for linebreak) and footer start
      content: new monaco.Range(
        scanned.splitter.rangeIncludingLineBreak.endLineNumber,
        scanned.splitter.rangeIncludingLineBreak.endColumn,
        scanned.endFooter.range.startLineNumber,
        scanned.endFooter.range.startColumn,
      ),
      name: scanned.endFooter.text.substring(endFooterMarker.length + 1),
    },
    // Entire range is between current header start and incoming header end (including line break)
    range: new monaco.Range(
      scanned.startHeader.range.startLineNumber,
      scanned.startHeader.range.startColumn,
      scanned.endFooter.range.endLineNumber,
      scanned.endFooter.range.endColumn,
    ),
  };
}

function shiftBackOneCharacter(
  document: monaco.editor.ITextModel,
  range: monaco.Position,
  unlessEqual: monaco.Position,
): monaco.Position {
  if (range.equals(unlessEqual)) {
    return range;
  }

  let line = range.lineNumber;
  let character = range.column - 1;

  if (character < 0) {
    line--;
    character = new TextLine(document, line).range.endColumn;
  }
  return new monaco.Position(line, character);
}

export class DocumentMergeConflict implements ICacheDocumentMergeConflict {
  /**
   * full range of the conflict, including header, splitter, footer
   */
  public range: monaco.Range;
  public current: IMergeRegion;
  public incoming: IMergeRegion;
  public commonAncestors: IMergeRegion[];
  public splitter: monaco.Range;

  constructor(descriptor: IDocumentMergeConflictDescriptor) {
    this.range = descriptor.range;
    this.current = descriptor.current;
    this.incoming = descriptor.incoming;
    this.commonAncestors = descriptor.commonAncestors;
    this.splitter = descriptor.splitter;
  }
}
