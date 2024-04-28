import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { distinct } from '@opensumi/monaco-editor-core/esm/vs/base/common/arrays';

import { DetailedLineRangeMapping } from '../../../common/diff';

import { MappingManagerDataStore } from './mapping-manager.store';
import { DocumentMapping } from './model/document-mapping';
import { LineRange } from './model/line-range';
import { ECompleteReason, EDiffRangeTurn, ETurnDirection, EditorViewType } from './types';

@Injectable()
export class MappingManagerService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(MappingManagerDataStore)
  private readonly dataStore: MappingManagerDataStore;

  /**
   * 与左侧编辑器的映射关系，见 {@link EDiffRangeTurn.ORIGIN}
   */
  public documentMappingTurnLeft: DocumentMapping;
  /**
   * 与右侧编辑器的映射关系，见 {@link EDiffRangeTurn.MODIFIED}
   */
  public documentMappingTurnRight: DocumentMapping;

  protected markCompleteFactoryTurnLeft: (range: LineRange, reason: ECompleteReason) => void;
  protected markCompleteFactoryTurnRight: (range: LineRange, reason: ECompleteReason) => void;
  protected revokeActionsFactoryTurnLeft: (oppositeRange: LineRange) => void;
  protected revokeActionsFactoryTurnRight: (oppositeRange: LineRange) => void;

  constructor() {
    super();

    this.documentMappingTurnLeft = this.injector.get(DocumentMapping, [EDiffRangeTurn.ORIGIN]);
    this.documentMappingTurnRight = this.injector.get(DocumentMapping, [EDiffRangeTurn.MODIFIED]);

    this.markCompleteFactoryTurnLeft = this.markCompleteFactory(EDiffRangeTurn.ORIGIN);
    this.markCompleteFactoryTurnRight = this.markCompleteFactory(EDiffRangeTurn.MODIFIED);
    this.revokeActionsFactoryTurnLeft = this.revokeActionsFactory(EDiffRangeTurn.ORIGIN);
    this.revokeActionsFactoryTurnRight = this.revokeActionsFactory(EDiffRangeTurn.MODIFIED);
  }

  private revokeActionsFactory(turn: EDiffRangeTurn): (oppositeRange: LineRange) => void {
    const mapping = turn === EDiffRangeTurn.ORIGIN ? this.documentMappingTurnLeft : this.documentMappingTurnRight;

    return (oppositeRange: LineRange) => {
      const range = mapping.reverse(oppositeRange);
      if (!range) {
        return;
      }

      range.cancel();
      /**
       * 这里需要从 mapping 的 adjacentComputeRangeMap 集合里获取并修改 complete 状态，否则变量内存就不是指向同一引用
       */
      const realOppositeRange = mapping.adjacentComputeRangeMap.get(range.id);
      if (realOppositeRange) {
        realOppositeRange.cancel();
      }
    };
  }

  private markCompleteFactory(turn: EDiffRangeTurn): (range: LineRange, reason: ECompleteReason) => void {
    const mapping = turn === EDiffRangeTurn.ORIGIN ? this.documentMappingTurnLeft : this.documentMappingTurnRight;

    return (range: LineRange, reason: ECompleteReason) => {
      const oppositeRange = mapping.adjacentComputeRangeMap.get(range.id);
      if (!oppositeRange) {
        return;
      }

      // 标记该 range 区域已经解决完成
      range.done(reason);
      oppositeRange.done(reason);

      /**
       * 如果被标记 complete 的 range 是 merge range 合成的，则需要将另一个 mapping 的对应关系也标记成 complete
       */
      if (oppositeRange.turnDirection === ETurnDirection.BOTH) {
        const reverseMapping =
          range.turnDirection === ETurnDirection.CURRENT ? this.documentMappingTurnRight : this.documentMappingTurnLeft;

        const reverse = reverseMapping.reverse(oppositeRange);
        if (!reverse) {
          return;
        }

        const adjacentRange = reverseMapping.adjacentComputeRangeMap.get(reverse.id);
        if (!adjacentRange) {
          return;
        }

        adjacentRange.done(reason);
      }
    };
  }

  public inputComputeResultRangeMappingTurnLeft(changes: readonly DetailedLineRangeMapping[]): void {
    this.documentMappingTurnLeft.inputComputeResultRangeMapping(changes);
  }

  public inputComputeResultRangeMappingTurnRight(changes: readonly DetailedLineRangeMapping[]): void {
    this.documentMappingTurnRight.inputComputeResultRangeMapping(changes);
  }

  public markCompleteTurnLeft(range: LineRange, reason: ECompleteReason): void {
    this.markCompleteFactoryTurnLeft(range, reason);
  }

  public markCompleteTurnRight(range: LineRange, reason: ECompleteReason): void {
    this.markCompleteFactoryTurnRight(range, reason);
  }

  public revokeActionsTurnLeft(oppositeRange: LineRange): void {
    this.revokeActionsFactoryTurnLeft(oppositeRange);
  }

  public revokeActionsTurnRight(oppositeRange: LineRange): void {
    this.revokeActionsFactoryTurnRight(oppositeRange);
  }

  public clearMapping(): void {
    this.documentMappingTurnLeft.clear();
    this.documentMappingTurnRight.clear();
  }

  /**
   * 分别找出离目标 lineRange 最近的 documentMappingTurnLeft 和 documentMappingTurnRight 里的 lineRange
   * 其中 target 只能是 result view 视图中的 range
   */
  public findNextLineRanges(target: LineRange): {
    [key in EditorViewType.CURRENT | EditorViewType.INCOMING]: LineRange | undefined;
  } {
    const [turnLeftRange, turnRightRange] = [this.documentMappingTurnLeft, this.documentMappingTurnRight].map(
      (mapping) => mapping.findNextOppositeRange(target),
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

  /**
   * 去重相同 id 或位置一样的 line range
   *
   * 返回所有的 diff range
   */
  public getAllDiffRanges(): LineRange[] {
    return distinct(
      this.documentMappingTurnLeft.getModifiedRange().concat(this.documentMappingTurnRight.getOriginalRange()),
      (range) => range.id,
    );
  }
}
