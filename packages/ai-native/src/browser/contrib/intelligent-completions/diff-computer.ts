import { ICodeEditor, IRange, ITextModel } from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';

/**
 * @internal
 */
export interface IMultiLineDiffChangeResult {
  added?: boolean;
  removed?: boolean;
  value: string;
}

interface IResultWithCount extends IMultiLineDiffChangeResult {
  count: number;
}

interface IElement {
  newPos: number;
  changeResult: IResultWithCount[];
}

class MultiLineDiffComputer {
  private extractCommon(element: IElement, modified: string[], original: string[], diagonal: number): number {
    const modifiedLength = modified.length;
    const originalLength = original.length;

    let newPos = element.newPos;
    let originalPos = newPos - diagonal;
    let commonCount = 0;

    while (
      newPos + 1 < modifiedLength &&
      originalPos + 1 < originalLength &&
      this.equals(modified[newPos + 1], original[originalPos + 1])
    ) {
      // 如果相等，则移动到下一个位置并计数加一
      newPos++;
      originalPos++;
      commonCount++;
    }

    // 如果找到公共部分，则记录新位置
    if (commonCount) {
      element.changeResult.push({ count: commonCount, value: empty });
      element.newPos = newPos;
    }

    return originalPos;
  }

  protected equals(a: string, b: string | undefined): boolean {
    return a === b;
  }

  protected tokenize(content: string): string[] {
    return content.split(empty).filter(Boolean);
  }

  public diff(originalContent: string, modifiedContent: string): IResultWithCount[] | undefined {
    const cloneElement = (element: IElement): IElement => ({
      newPos: element.newPos,
      changeResult: [...element.changeResult],
    });
    const join = (content: string[]) => content.join(empty);

    const processElements = (changeResult: IResultWithCount[], modified: string[], original: string[]) => {
      const modifiedLength = changeResult.length;

      let originalIndex = 0;
      let modifiedIndex = 0;
      let originalCount = 0;

      for (; originalIndex < modifiedLength; originalIndex++) {
        const changeItem = changeResult[originalIndex];
        // 如果标记为删除，则从原始内容中提取对应的值
        if (changeItem.removed) {
          changeItem.value = join(original.slice(originalCount, originalCount + changeItem.count));
          originalCount += changeItem.count;
          // 如果前一个元素被标记为添加，则交换位置
          if (originalIndex && changeResult[originalIndex - 1].added) {
            [changeResult[originalIndex - 1], changeResult[originalIndex]] = [
              changeResult[originalIndex],
              changeResult[originalIndex - 1],
            ];
          }
        } else {
          changeItem.value = join(modified.slice(modifiedIndex, modifiedIndex + changeItem.count));
          modifiedIndex += changeItem.count;

          if (!changeItem.added) {
            originalCount += changeItem.count;
          }
        }
      }

      // 如果最后一个元素是空字符串，则合并到前一个元素当中
      if (
        modifiedLength > 1 &&
        typeof changeResult[modifiedLength - 1].value === 'string' &&
        (changeResult[modifiedLength - 1].added || changeResult[modifiedLength - 1].removed) &&
        this.equals(empty, changeResult[modifiedLength - 1].value)
      ) {
        changeResult[modifiedLength - 2].value += changeResult[modifiedLength - 1].value;
        changeResult.pop();
      }
      return changeResult;
    };

    const tokenizeOriginal = this.tokenize(originalContent);
    const tokenizeModified = this.tokenize(modifiedContent);
    const originalLength = tokenizeOriginal.length;
    const modifiedLength = tokenizeModified.length;
    const maxLength = originalLength + modifiedLength;

    const elements: Array<IElement | undefined> = [{ newPos: -1, changeResult: [] }];
    const initialDiagonal = this.extractCommon(elements[0]!, tokenizeModified, tokenizeOriginal, 0);

    const pushElement = (changeResult: IResultWithCount[], added?: boolean, removed?: boolean) => {
      const len = changeResult.length;
      const latestResult = changeResult[len - 1];
      if (len > 0 && latestResult.added === added && latestResult.removed === removed) {
        changeResult[len - 1] = { count: latestResult.count + 1, added, removed, value: empty };
      } else {
        changeResult.push({ count: 1, added, removed, value: empty });
      }
    };

    let diagonal = 1;

    // 如果初始位置加 1 大于或等于原始长度，并且初始的公共部分的位置加 1 大于或等于修改后的长度，则直接返回修改后的内容
    if (elements[0]!.newPos + 1 >= originalLength && initialDiagonal + 1 >= modifiedLength) {
      return [
        {
          value: join(tokenizeModified),
          count: tokenizeModified.length,
        },
      ];
    }

    const execDiff = () => {
      for (let diagonalIndex = -diagonal; diagonalIndex <= diagonal; diagonalIndex += 2) {
        const leftElement = elements[diagonalIndex - 1];
        const rightElement = elements[diagonalIndex + 1];

        let element: IElement;
        let originalPos = (rightElement ? rightElement.newPos : 0) - diagonalIndex;

        // 如果左边有元素，则将其标记为未知
        if (leftElement) {
          elements[diagonalIndex - 1] = undefined;
        }

        const canMoveLeft = leftElement && leftElement.newPos + 1 < modifiedLength;
        const canMoveRight = rightElement && 0 <= originalPos && originalPos < originalLength;

        // 如果不能向左或向右移动，则跳过
        if (!canMoveLeft && !canMoveRight) {
          elements[diagonalIndex] = undefined;
          continue;
        }

        // 根据移动方向选择元素
        if (!canMoveLeft || (canMoveRight && leftElement.newPos < rightElement.newPos)) {
          element = cloneElement(rightElement!);
          pushElement(element.changeResult, undefined, true);
        } else {
          element = leftElement;
          element.newPos++;
          pushElement(element.changeResult, true, undefined);
        }

        originalPos = this.extractCommon(element, tokenizeModified, tokenizeOriginal, diagonalIndex);

        if (element.newPos + 1 >= modifiedLength && originalPos + 1 >= originalLength) {
          return processElements(element.changeResult, tokenizeModified, tokenizeOriginal);
        }

        elements[diagonalIndex] = element;
      }
      diagonal++;
    };

    while (diagonal <= maxLength) {
      const diffResult = execDiff();
      if (diffResult) {
        return diffResult;
      }
    }
  }
}

const identifierPattern = /^[a-zA-Z]+$/u;
const splitPattern = /([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/;

class RewriteDiffComputer extends MultiLineDiffComputer {
  override equals(a: string, b: string): boolean {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    return lowerA === lowerB;
  }

  override tokenize(content: string): string[] {
    const tokens = content.split(splitPattern);

    for (let tokenIndex = 0; tokenIndex < tokens.length - 1; tokenIndex++) {
      const nextToken = tokens[tokenIndex + 1];
      const nextNextToken = tokens[tokenIndex + 2];
      if (
        !nextToken &&
        nextNextToken &&
        identifierPattern.test(tokens[tokenIndex]) &&
        identifierPattern.test(nextNextToken)
      ) {
        tokens[tokenIndex] += nextNextToken;
        tokens.splice(tokenIndex + 1, 2);
        tokenIndex--;
      }
    }

    return tokens;
  }
}

export const multiLineDiffComputer = new MultiLineDiffComputer();
export const rewriteDiffComputer = new RewriteDiffComputer();

export const mergeMultiLineDiffChanges = (
  lines: IMultiLineDiffChangeResult[],
  eol: string,
): IMultiLineDiffChangeResult[] => {
  const modifiedLines = lines.flatMap((line) => {
    const segments = line.value.split(eol);
    const wrap = (value: string): IMultiLineDiffChangeResult => ({ value, added: line.added, removed: line.removed });

    return segments
      .flatMap((segment, index) => {
        if (index < segments.length - 1) {
          return [wrap(segment), wrap(eol)];
        }

        return wrap(segment);
      })
      .filter((line) => line.value !== empty);
  });

  // 对处理后的结果进行调整，确保相邻的添加和删除操作合并
  for (let i = 0; i < modifiedLines.length - 1; i++) {
    const currentLine = modifiedLines[i];
    const nextLine = modifiedLines[i + 1];
    // 如果当前行是删除操作，下一行是添加操作，并且下一行的值以当前行的值开头，则合并这两个操作
    if (currentLine.removed && nextLine.added && nextLine.value.startsWith(currentLine.value)) {
      currentLine.added = true;
      currentLine.removed = true;
    }
  }

  return modifiedLines;
};

/**
 * 根据原始内容和要修改的内容，返回字符级或单词级的差异
 */
export const computeMultiLineDiffChanges = (
  originalContent: string,
  modifiedContent: string,
  monacoEditor: ICodeEditor,
  lineNumber: number,
  eol: string,
) => {
  let rewriteDiffResult: IMultiLineDiffChangeResult[] =
    rewriteDiffComputer.diff(originalContent, modifiedContent) || [];
  let multiLineDiffResult: IMultiLineDiffChangeResult[] =
    multiLineDiffComputer.diff(originalContent, modifiedContent) || [];

  const originalLines = originalContent.split(eol);
  const modifiedLines = modifiedContent.split(eol);

  if (
    originalLines.length === modifiedLines.length &&
    originalLines.every((value, index) => modifiedLines[index].startsWith(value))
  ) {
    multiLineDiffResult = originalLines
      .map((value, index) => {
        const modifiedLine = modifiedLines[index];
        const diffElements: IMultiLineDiffChangeResult[] = [
          {
            value,
          },
        ];

        if (modifiedLine !== value) {
          const addedPart = modifiedLine.substring(value.length);
          diffElements.push(
            {
              value: addedPart,
              added: true,
            },
            {
              value: eol,
            },
          );
        } else {
          diffElements[0].value = diffElements[0].value + eol;
        }
        return diffElements;
      })
      .flat();
  }

  const currentCursorPosition = monacoEditor.getPosition();

  if (currentCursorPosition) {
    const lineAndColumn = {
      lineNumber: currentCursorPosition.lineNumber - lineNumber + 1,
      column: currentCursorPosition.column,
    };

    const prefix = originalLines.slice(0, lineAndColumn.lineNumber - 1).join(eol);
    const linePrefix = originalLines[lineAndColumn.lineNumber - 1]?.slice(0, lineAndColumn.column - 1);

    const prefixMatch = prefix === modifiedLines.slice(0, lineAndColumn.lineNumber - 1).join(eol);
    const linePrefixMatch =
      linePrefix === modifiedLines[lineAndColumn.lineNumber - 1]?.slice(0, lineAndColumn.column - 1);

    if (prefixMatch && linePrefixMatch) {
      const suffix = (line: string[]) =>
        line[lineAndColumn.lineNumber - 1]?.slice(lineAndColumn.column - 1) +
        eol +
        line.slice(lineAndColumn.lineNumber).join(eol);

      const modifiedContent = suffix(modifiedLines);
      const originalContent = suffix(originalLines);
      const commonPrefix =
        prefix + (originalLines.slice(0, lineAndColumn.lineNumber - 1).length > 0 ? eol : empty) + linePrefix;

      if (modifiedContent.endsWith(originalContent)) {
        const modifiedContentPrefix = modifiedContent.slice(0, modifiedContent.length - originalContent.length);
        multiLineDiffResult = [
          {
            value: commonPrefix,
          },
          {
            value: modifiedContentPrefix,
            added: true,
          },
          {
            value: originalContent,
          },
        ];
      }
    }
  }

  const mergeRewriteLine = mergeMultiLineDiffChanges(rewriteDiffResult, eol);
  const isOnlyAddingToEachWord =
    originalLines.length === modifiedLines.length &&
    !mergeRewriteLine.some((item) => item.added !== true && item.removed && item.value !== eol);

  const mergeMultiLine = mergeMultiLineDiffChanges(multiLineDiffResult, eol);

  return {
    singleLineCharChanges: mergeMultiLine,
    charChanges: multiLineDiffResult,
    wordChanges: rewriteDiffResult,
    isOnlyAddingToEachWord,
  };
};

/**
 * 将单词级别的 change 转换为行级别的 change 映射
 */
export const wordChangesToLineChangesMap = (
  wordChanges: IMultiLineDiffChangeResult[],
  range: IRange,
  model: ITextModel | null,
) => {
  const lineChangesMap: { [lineNumber: number]: IMultiLineDiffChangeResult[][] } = {};
  const eol = model?.getEOL()!;

  let currentLineNumber = range.startLineNumber;

  const addChange = (change: IMultiLineDiffChangeResult) => {
    if (!lineChangesMap[currentLineNumber]) {
      lineChangesMap[currentLineNumber] = [];
    }
    lineChangesMap[currentLineNumber].push([change]);
  };

  const pushToLastChange = (change: IMultiLineDiffChangeResult) => {
    const lastChanges = lineChangesMap[currentLineNumber]?.[lineChangesMap[currentLineNumber].length - 1];
    if (lastChanges) {
      lastChanges.push(change);
    } else {
      addChange(change);
    }
  };

  const moveToNextLine = () => {
    currentLineNumber++;
  };

  wordChanges.forEach((change) => {
    const { value, added, removed } = change;
    const segments = value.split(eol);

    segments.forEach((segment, index) => {
      if (index === 0) {
        pushToLastChange({ value: segment, added, removed });
      } else {
        moveToNextLine();
        addChange({ value: segment, added, removed });
      }
    });
  });

  return lineChangesMap;
};
