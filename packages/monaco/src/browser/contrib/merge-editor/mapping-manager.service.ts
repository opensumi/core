import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { DocumentMapping } from './model/document-mapping';
import { LineRange } from './model/line-range';
import { LineRangeMapping } from './model/line-range-mapping';
import { EDiffRangeTurn, EditorViewType, ETurnDirection } from './types';

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

  private revokeActionsFactory(turn: EDiffRangeTurn): (sameRange: LineRange) => void {
    const mapping = turn === EDiffRangeTurn.ORIGIN ? this.documentMappingTurnLeft : this.documentMappingTurnRight;

    return (sameRange: LineRange) => {
      const range = mapping.reverse(sameRange);
      if (!range) {
        return;
      }

      range.setComplete(false);
      /**
       * 这里需要从 mapping 的 adjacentComputeRangeMap 集合里获取并修改 complete 状态，否则变量内存就不是指向同一引用
       */
      const realSameRange = mapping.adjacentComputeRangeMap.get(range.id);
      if (realSameRange) {
        realSameRange.setComplete(false);
      }
    };
  }

  private markCompleteFactory(turn: EDiffRangeTurn): (range: LineRange) => void {
    const mapping = turn === EDiffRangeTurn.ORIGIN ? this.documentMappingTurnLeft : this.documentMappingTurnRight;

    return (range: LineRange) => {
      const sameRange = mapping.adjacentComputeRangeMap.get(range.id);
      if (!sameRange) {
        return;
      }

      // 标记该 range 区域已经解决完成
      range.setComplete(true);
      sameRange.setComplete(true);

      /**
       * 如果被标记 complete 的 range 是 merge range 合成的，则需要将另一个 mapping 的对应关系也标记成 complete
       */
      if (sameRange.turnDirection === ETurnDirection.BOTH) {
        const reverseMapping =
          range.turnDirection === ETurnDirection.CURRENT ? this.documentMappingTurnRight : this.documentMappingTurnLeft;

        const reverse = reverseMapping.reverse(sameRange);
        if (!reverse) {
          return;
        }

        const adjacentRange = reverseMapping.adjacentComputeRangeMap.get(reverse.id);
        if (!adjacentRange) {
          return;
        }

        adjacentRange.setComplete(true);
      }
    };
  }

  public inputComputeResultRangeMappingTurnLeft(changes: LineRangeMapping[]): void {
    this.documentMappingTurnLeft.inputComputeResultRangeMapping(changes);
  }

  public inputComputeResultRangeMappingTurnRight(changes: LineRangeMapping[]): void {
    this.documentMappingTurnRight.inputComputeResultRangeMapping(changes);
  }

  public markCompleteTurnLeft(range: LineRange): void {
    this.markCompleteFactory(EDiffRangeTurn.ORIGIN)(range);
  }

  public markCompleteTurnRight(range: LineRange): void {
    this.markCompleteFactory(EDiffRangeTurn.MODIFIED)(range);
  }

  public revokeActionsTurnLeft(sameRange: LineRange): void {
    this.revokeActionsFactory(EDiffRangeTurn.ORIGIN)(sameRange);
  }

  public revokeActionsTurnRight(sameRange: LineRange): void {
    this.revokeActionsFactory(EDiffRangeTurn.MODIFIED)(sameRange);
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

  public findTouchesRanges(
    target: LineRange,
    isAllowContact = true,
  ): {
    [key in EditorViewType.CURRENT | EditorViewType.INCOMING]: LineRange | undefined;
  } {
    const [turnLeftRange, turnRightRange] = [this.documentMappingTurnLeft, this.documentMappingTurnRight].map(
      (mapping) => mapping.findTouchesRange(target, isAllowContact),
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
