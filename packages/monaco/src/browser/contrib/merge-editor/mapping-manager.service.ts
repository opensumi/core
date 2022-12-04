import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { DocumentMapping } from './model/document-mapping';
import { LineRange } from './model/line-range';
import { LineRangeMapping } from './model/line-range-mapping';
import { EDiffRangeTurn, EditorViewType } from './types';

@Injectable()
export class MappingManagerService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public documentMappingTurnLeft: DocumentMapping;
  public documentMappingTurnRight: DocumentMapping;

  constructor() {
    super();

    this.documentMappingTurnLeft = this.injector.get(DocumentMapping, [EDiffRangeTurn.ORIGIN]);
    this.documentMappingTurnRight = this.injector.get(DocumentMapping, [EDiffRangeTurn.MODIFIED]);
  }

  private markCompleteFactory(turn: EDiffRangeTurn): (range: LineRange, isIgnore: boolean) => void {
    const [mapping, sameMapping] =
      turn === EDiffRangeTurn.ORIGIN
        ? [this.documentMappingTurnLeft, this.documentMappingTurnRight]
        : [this.documentMappingTurnRight, this.documentMappingTurnLeft];

    return (range: LineRange, isIgnore: boolean) => {
      const sameRange = mapping.adjacentComputeRangeMap.get(range.id);
      if (!sameRange) {
        return;
      }

      const doMark = () => {
        // 标记该 range 区域已经解决完成
        range.setComplete(true);
        sameRange.setComplete(true);
      };

      if (isIgnore) {
        doMark();
      } else {
        const marginLength = range.calcMargin(sameRange);

        mapping.deltaAdjacentQueueAfter(range, marginLength);
        doMark();
        mapping.deltaEndAdjacent(sameRange, marginLength);

        const findNextRange = sameMapping.findNextSameRange(sameRange);
        const reverseRange = findNextRange && sameMapping.reverse(findNextRange);
        if (reverseRange) {
          sameMapping.deltaAdjacentQueueAfter(reverseRange, marginLength, true);
        }
      }
    };
  }

  public inputComputeResultRangeMappingTurnLeft(changes: LineRangeMapping[]): void {
    this.documentMappingTurnLeft.inputComputeResultRangeMapping(changes);
  }

  public inputComputeResultRangeMappingTurnRight(changes: LineRangeMapping[]): void {
    this.documentMappingTurnRight.inputComputeResultRangeMapping(changes);
  }

  public markCompleteTurnLeft(range: LineRange, isIgnore = false): void {
    this.markCompleteFactory(EDiffRangeTurn.ORIGIN)(range, isIgnore);
  }

  public markCompleteTurnRight(range: LineRange, isIgnore = false): void {
    this.markCompleteFactory(EDiffRangeTurn.MODIFIED)(range, isIgnore);
  }

  /**
   * 分别找出离目标 lineRange 最近的 documentMappingTurnLeft 和 documentMappingTurnRight 里的 lineRange
   * 其中 target 只能是 result view 视图中的 range
   */
  public findNextLineRanges(target: LineRange): {
    [key in EditorViewType.CURRENT | EditorViewType.INCOMING]: LineRange | undefined;
  } {
    const [turnLeftRange, turnRightRange] = [this.documentMappingTurnLeft, this.documentMappingTurnRight].map(
      (mapping) => mapping.findNextSameRange(target),
    );
    return {
      [EditorViewType.CURRENT]: turnLeftRange,
      [EditorViewType.INCOMING]: turnRightRange,
    };
  }

  public findTouchesRanges(target: LineRange): {
    [key in EditorViewType.CURRENT | EditorViewType.INCOMING]: LineRange | undefined;
  } {
    const [turnLeftRange, turnRightRange] = [this.documentMappingTurnLeft, this.documentMappingTurnRight].map(
      (mapping) => mapping.findTouchesRange(target),
    );
    return {
      [EditorViewType.CURRENT]: turnLeftRange,
      [EditorViewType.INCOMING]: turnRightRange,
    };
  }

  /**
   * 检查目标 lineRange 是被包裹在哪一个 documentMapping 的其中一个 LineRange 内
   * 有可能左右两者都有包含
   * 其中 target 只能是 result view 视图中的 range
   */
  public findIncludeRanges(target: LineRange): {
    [key in EditorViewType.CURRENT | EditorViewType.INCOMING]: LineRange | undefined;
  } {
    const [turnLeftRange, turnRightRange] = [this.documentMappingTurnLeft, this.documentMappingTurnRight].map(
      (mapping) => mapping.findIncludeRange(target),
    );

    return {
      [EditorViewType.CURRENT]: turnLeftRange,
      [EditorViewType.INCOMING]: turnRightRange,
    };
  }
}
