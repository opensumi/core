import { empty } from '@opensumi/ide-utils/lib/strings';

interface IChangeItem {
  count: number;
  value: string;
}

enum EDiffMode {
  added = 'added',
  removed = 'removed',
  unchanged = 'unchanged',
}

interface IDiffChangeResult extends IChangeItem {
  mode: EDiffMode;
}

interface IElement {
  newPos: number;
  changeResult: IDiffChangeResult[];
}

export class IntelligentCompletionDiffComputer {
  private equals(a: string, b: string | undefined): boolean {
    return a === b;
  }

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
      element.changeResult.push({ count: commonCount, value: empty, mode: EDiffMode.unchanged });
      element.newPos = newPos;
    }

    return originalPos;
  }

  public diff(originalContent: string, modifiedContent: string) {
    const cloneElement = (element: IElement): IElement => ({
      newPos: element.newPos,
      changeResult: [...element.changeResult],
    });
    const join = (content: string[]) => content.join(empty);

    const processElements = (changeResult: IDiffChangeResult[], modified: string[], original: string[]) => {
      const modifiedLength = changeResult.length;

      let originalIndex = 0;
      let modifiedIndex = 0;
      let originalCount = 0;

      for (; originalIndex < modifiedLength; originalIndex++) {
        const changeItem = changeResult[originalIndex];
        // 如果标记为删除，则从原始内容中提取对应的值
        if (changeItem.mode === EDiffMode.removed) {
          changeItem.value = join(original.slice(originalCount, originalCount + changeItem.count));
          originalCount += changeItem.count;
          // 如果前一个元素被标记为添加，则交换位置
          if (originalIndex && changeResult[originalIndex - 1].mode === EDiffMode.added) {
            [changeResult[originalIndex - 1], changeResult[originalIndex]] = [
              changeResult[originalIndex],
              changeResult[originalIndex - 1],
            ];
          }
        } else {
          changeItem.value = join(modified.slice(modifiedIndex, modifiedIndex + changeItem.count));
          modifiedIndex += changeItem.count;

          if (changeItem.mode !== EDiffMode.added) {
            originalCount += changeItem.count;
          }
        }
      }

      // 如果最后一个元素是空字符串，则合并到前一个元素当中
      if (
        modifiedLength > 1 &&
        typeof changeResult[modifiedLength - 1].value === 'string' &&
        changeResult[modifiedLength - 1].mode !== EDiffMode.unchanged &&
        this.equals(empty, changeResult[modifiedLength - 1].value)
      ) {
        changeResult[modifiedLength - 2].value += changeResult[modifiedLength - 1].value;
        changeResult.pop();
      }
      return changeResult;
    };

    const tokenizeOriginal = originalContent.split(empty).filter(Boolean);
    const tokenizeModified = modifiedContent.split(empty).filter(Boolean);
    const originalLength = tokenizeOriginal.length;
    const modifiedLength = tokenizeModified.length;
    const maxLength = originalLength + modifiedLength;

    const elements: Array<IElement | undefined> = [{ newPos: -1, changeResult: [] }];
    const initialDiagonal = this.extractCommon(elements[0]!, tokenizeModified, tokenizeOriginal, 0);

    const pushElement = (changeResult: IDiffChangeResult[], mode: EDiffMode) => {
      const len = changeResult.length;
      const latestResult = changeResult[len - 1];
      if (len > 0 && latestResult.mode === mode) {
        changeResult[len - 1] = { count: latestResult.count + 1, mode, value: empty };
      } else {
        changeResult.push({ count: 1, mode, value: empty });
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
          pushElement(element.changeResult, EDiffMode.removed);
        } else {
          element = leftElement;
          element.newPos++;
          pushElement(element.changeResult, EDiffMode.added);
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
      if (diffResult) {return diffResult;}
    }
  }
}
