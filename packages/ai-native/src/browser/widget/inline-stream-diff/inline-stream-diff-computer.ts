import { equals } from '@opensumi/monaco-editor-core/esm/vs/base/common/arrays';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { OffsetRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/offsetRange';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import {
  DateTimeout,
  DiffAlgorithmResult,
  InfiniteTimeout,
  SequenceDiff,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/diffAlgorithm';
import { DefaultLinesDiffComputer } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer';
import { LineSequence } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/defaultLinesDiffComputer/lineSequence';
import { Array2D } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/defaultLinesDiffComputer/utils';
import {
  ILinesDiffComputerOptions,
  LinesDiff,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import {
  DetailedLineRangeMapping,
  RangeMapping,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';

export interface IEnhanceLinesDiffComputerOptions extends ILinesDiffComputerOptions {
  onlyCareAboutPrefixOfOriginalLines: boolean;
}

/**
 * 实现类似 Levenshtein 的算法找到最小编辑距离
 */
const levenshteinDiffAlgorithmCompute = (
  originalLines: LineSequence,
  modifiedLines: LineSequence,
  timeout = InfiniteTimeout.instance,
): DiffAlgorithmResult => {
  if (!originalLines.length || !modifiedLines.length) {
    return DiffAlgorithmResult.trivial(originalLines, modifiedLines);
  }

  const directions = new Array2D<number>(2 * originalLines.length + 1, modifiedLines.length + 1);
  const isMatch = new Array2D<boolean>(2 * originalLines.length + 1, modifiedLines.length + 1);

  for (let modifiedLineIndex = 0; modifiedLineIndex <= modifiedLines.length; modifiedLineIndex++) {
    directions.set(0, modifiedLineIndex, modifiedLineIndex);
    isMatch.set(0, modifiedLineIndex, modifiedLineIndex > 0);
  }

  for (let originalLineIndex = 0; originalLineIndex <= 2 * originalLines.length; originalLineIndex++) {
    directions.set(originalLineIndex, 0, Math.floor((originalLineIndex + 1) / 2));
    isMatch.set(originalLineIndex, 0, false);
  }

  for (let modifiedLineIndex = 1; modifiedLineIndex <= modifiedLines.length; modifiedLineIndex++) {
    for (let originalLineIndex = 1; originalLineIndex <= 2 * originalLines.length; originalLineIndex++) {
      if (!timeout.isValid()) {
        return DiffAlgorithmResult.trivialTimedOut(originalLines, modifiedLines);
      }

      if (originalLineIndex % 2 === 0) {
        const deletionCost = directions.get(originalLineIndex, modifiedLineIndex - 1) + 1;
        const insertionCost = directions.get(originalLineIndex - 1, modifiedLineIndex);
        const isDeletion = deletionCost < insertionCost;
        directions.set(originalLineIndex, modifiedLineIndex, isDeletion ? deletionCost : insertionCost);
        isMatch.set(originalLineIndex, modifiedLineIndex, isDeletion);
      } else {
        const substitutionCost = directions.get(originalLineIndex - 1, modifiedLineIndex) + 0.4;
        const matchCost =
          originalLines.getElement(Math.floor(originalLineIndex / 2)) ===
          modifiedLines.getElement(modifiedLineIndex - 1)
            ? directions.get(originalLineIndex - 1, modifiedLineIndex - 1)
            : Number.MAX_VALUE;
        const isDeletion = matchCost < substitutionCost;
        directions.set(originalLineIndex, modifiedLineIndex, isDeletion ? matchCost : substitutionCost);
        isMatch.set(originalLineIndex, modifiedLineIndex, isDeletion);
      }
    }
  }

  let minCost = Number.MAX_VALUE;
  let minCostIndex = -1;

  for (let originalLineIndex = 0; originalLineIndex <= 2 * originalLines.length; originalLineIndex++) {
    const cost = directions.get(originalLineIndex, modifiedLines.length);
    if (cost < minCost) {
      minCost = cost;
      minCostIndex = originalLineIndex;
    }
  }

  const diffSequences: SequenceDiff[] = [];
  let currentOriginalLineIndex = minCostIndex;
  let currentModifiedLineIndex = modifiedLines.length;

  if (currentOriginalLineIndex <= 2 * originalLines.length - 2) {
    diffSequences.push(
      new SequenceDiff(
        new OffsetRange(Math.floor((currentOriginalLineIndex + 1) / 2), originalLines.length),
        new OffsetRange(currentModifiedLineIndex, currentModifiedLineIndex),
      ),
    );
  }

  let lastMatch: { originalLineIndex: number; modifiedLineIndex: number } | undefined;

  // 根据匹配矩阵和差异矩阵来构建差异序列。
  // 先从最终的差异矩阵的最小位置开始，向上和向左遍历，根据是否匹配来决定是构建差异序列还是更新最后一个匹配的位置。
  // 如果当前位置匹配，则根据当前位置的奇偶性来决定是否更新最后一个匹配的位置或构建差异序列。
  // 如果当前位置不匹配，则更新最后一个匹配的位置。
  // 遍历过程中，根据匹配情况和最后一个匹配的位置来构建差异序列，并将其添加到diffSequences数组中。
  // 遍历结束后，diffSequences数组将包含所有的差异序列。
  while (currentOriginalLineIndex >= 0 && currentModifiedLineIndex >= 0) {
    if (isMatch.get(currentOriginalLineIndex, currentModifiedLineIndex)) {
      if (currentOriginalLineIndex % 2 === 0) {
        if (lastMatch === undefined) {
          lastMatch = {
            originalLineIndex: Math.floor(currentOriginalLineIndex / 2),
            modifiedLineIndex: currentModifiedLineIndex,
          };
        }
      } else {
        if (lastMatch !== undefined) {
          if (
            lastMatch.originalLineIndex !== Math.floor(currentOriginalLineIndex / 2) + 1 ||
            lastMatch.modifiedLineIndex !== currentModifiedLineIndex
          ) {
            diffSequences.push(
              new SequenceDiff(
                new OffsetRange(Math.floor(currentOriginalLineIndex / 2) + 1, lastMatch.originalLineIndex),
                new OffsetRange(currentModifiedLineIndex, lastMatch.modifiedLineIndex),
              ),
            );
          }
          lastMatch = undefined;
        }
        currentOriginalLineIndex -= 1;
      }

      currentModifiedLineIndex -= 1;
    } else {
      lastMatch = lastMatch || {
        originalLineIndex: Math.floor((currentOriginalLineIndex + 1) / 2),
        modifiedLineIndex: currentModifiedLineIndex,
      };
      currentOriginalLineIndex -= 1;
    }
  }

  if (lastMatch !== undefined) {
    if (
      lastMatch.originalLineIndex !== Math.floor(currentOriginalLineIndex / 2) + 1 ||
      lastMatch.modifiedLineIndex !== currentModifiedLineIndex
    ) {
      diffSequences.push(
        new SequenceDiff(
          new OffsetRange(Math.floor(currentOriginalLineIndex / 2) + 1, lastMatch.originalLineIndex),
          new OffsetRange(currentModifiedLineIndex, lastMatch.modifiedLineIndex),
        ),
      );
    }
    lastMatch = undefined;
  }

  diffSequences.reverse();
  return new DiffAlgorithmResult(diffSequences, false);
};

export class InlineStreamDiffComputer extends DefaultLinesDiffComputer {
  override computeDiff(
    originalLines: string[],
    modifiedLines: string[],
    options: IEnhanceLinesDiffComputerOptions,
  ): LinesDiff {
    /**
     * 前序逻辑复用 defaultLinesDiffComputer 的 computeDiff
     * https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.ts#L26
     */
    if (originalLines.length <= 1 && equals(originalLines, modifiedLines, (a, b) => a === b)) {
      return new LinesDiff([], [], false);
    }

    if (
      (originalLines.length === 1 && originalLines[0].length === 0) ||
      (modifiedLines.length === 1 && modifiedLines[0].length === 0)
    ) {
      return new LinesDiff(
        [
          new DetailedLineRangeMapping(
            new LineRange(1, originalLines.length + 1),
            new LineRange(1, modifiedLines.length + 1),
            [
              new RangeMapping(
                new Range(1, 1, originalLines.length, originalLines[originalLines.length - 1].length + 1),
                new Range(1, 1, modifiedLines.length, modifiedLines[modifiedLines.length - 1].length + 1),
              ),
            ],
          ),
        ],
        [],
        false,
      );
    }

    const timeout =
      options.maxComputationTimeMs === 0 ? InfiniteTimeout.instance : new DateTimeout(options.maxComputationTimeMs);

    const perfectHashes = new Map<string, number>();
    function getOrCreateHash(text: string): number {
      let hash = perfectHashes.get(text);
      if (hash === undefined) {
        hash = perfectHashes.size;
        perfectHashes.set(text, hash);
      }
      return hash;
    }

    const isCarePrefixLines =
      originalLines.length * modifiedLines.length < 1e6 && options.onlyCareAboutPrefixOfOriginalLines;

    const originalLinesHashes = originalLines.map((l) => getOrCreateHash(isCarePrefixLines ? l : l.trim()));
    const modifiedLinesHashes = modifiedLines.map((l) => getOrCreateHash(isCarePrefixLines ? l : l.trim()));
    const sequence1 = new LineSequence(originalLinesHashes, originalLines);
    const sequence2 = new LineSequence(modifiedLinesHashes, modifiedLines);

    const isAllEmpty = originalLines.every((V) => V.trim().length === 0);

    let lineAlignmentResult: DiffAlgorithmResult;

    if (isCarePrefixLines) {
      if (isAllEmpty) {
        lineAlignmentResult = DiffAlgorithmResult.trivial(sequence1, sequence2);
      } else {
        lineAlignmentResult = levenshteinDiffAlgorithmCompute(sequence1, sequence2, timeout);
      }
    } else {
      if (sequence1.length + sequence2.length < 1700) {
        lineAlignmentResult = this['dynamicProgrammingDiffing'].compute(
          sequence1,
          sequence2,
          timeout,
          (offset1: number, offset2: number) => {
            if (originalLines[offset1] === modifiedLines[offset2]) {
              if (modifiedLines[offset2].length === 0) {
                return 0.1;
              } else {
                return 1 + Math.log(1 + modifiedLines[offset2].length);
              }
            } else {
              return 0.99;
            }
          },
        );
      } else {
        lineAlignmentResult = this['myersDiffingAlgorithm'].compute(sequence1, sequence2, timeout);
      }
    }

    const lineAlignments = lineAlignmentResult.diffs;
    const hitTimeout = lineAlignmentResult.hitTimeout;

    if (isCarePrefixLines) {
      const diffs = lineAlignments.map(
        (line) =>
          new DetailedLineRangeMapping(
            new LineRange(line.seq1Range.start + 1, line.seq1Range.endExclusive + 1),
            new LineRange(line.seq2Range.start + 1, line.seq2Range.endExclusive + 1),
            [],
          ),
      );
      return new LinesDiff(diffs, [], hitTimeout);
    }

    return super.computeDiff(originalLines, modifiedLines, options);
  }
}
