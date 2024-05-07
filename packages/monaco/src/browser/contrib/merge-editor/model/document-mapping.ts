import { Injectable, Optional } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { DetailedLineRangeMapping } from '../../../../common/diff';
import { EDiffRangeTurn } from '../types';

import { LineRange } from './line-range';

/**
 * 反映在文档上的 LineRangeMapping 映射关系
 * editor 视图要渲染的 decoration 也是从这里拿到源数据
 * conflict actions 的各种操作如 accept current 或 ignore 等也需要计算该源数据，因为当触发 accept 后，result 视图的文本内容受到改变后，同位的映射关系位置也会发生变化
 * 例: 点击左侧视图的 accept 操作，导致 result 视图的文本增加了 3 行（e.g 第 3 行到第 6 行增加了文本）, 那么这第 3 行之后的所有源数据的 lineRange offset 都需要增加 3
 * 这样再后续处理其他的 conflict 操作时才能计算正确
 *
 * @param diffRangeTurn {@link EDiffRangeTurn} 用于区分当前的映射关系
 */
@Injectable({ multiple: true })
export class DocumentMapping extends Disposable {
  public adjacentComputeRangeMap: Map<string, LineRange> = new Map();
  public computeRangeMap: Map<string, LineRange> = new Map();

  constructor(@Optional() private readonly diffRangeTurn: EDiffRangeTurn) {
    super();
  }

  private ensureSort(values: IterableIterator<LineRange>): LineRange[] {
    return Array.from(values).sort((a, b) => a.startLineNumber - b.startLineNumber);
  }

  public getMetaLineRangeMapping(): DetailedLineRangeMapping[] {
    const result: DetailedLineRangeMapping[] = [];

    this.computeRangeMap.forEach((range) => {
      if (this.diffRangeTurn === EDiffRangeTurn.ORIGIN) {
        result.push(new DetailedLineRangeMapping(range, this.adjacentComputeRangeMap.get(range.id)!, []));
      } else if (this.diffRangeTurn === EDiffRangeTurn.MODIFIED) {
        result.push(new DetailedLineRangeMapping(this.adjacentComputeRangeMap.get(range.id)!, range, []));
      }
    });
    return result;
  }

  public getOriginalRange(): LineRange[] {
    return this.ensureSort(
      this.diffRangeTurn === EDiffRangeTurn.ORIGIN
        ? this.computeRangeMap.values()
        : this.adjacentComputeRangeMap.values(),
    );
  }

  public getModifiedRange(): LineRange[] {
    return this.ensureSort(
      this.diffRangeTurn === EDiffRangeTurn.ORIGIN
        ? this.adjacentComputeRangeMap.values()
        : this.computeRangeMap.values(),
    );
  }

  /**
   * 取对位的 range
   */
  public reverse(range: LineRange): LineRange | undefined {
    const entries = this.adjacentComputeRangeMap.entries();
    for (const pack of entries) {
      const [k, v] = pack;
      if (v.id === range.id && this.computeRangeMap.has(k)) {
        return this.computeRangeMap.get(k);
      }
    }
  }

  public inputComputeResultRangeMapping(changes: readonly DetailedLineRangeMapping[]): void {
    switch (this.diffRangeTurn) {
      case EDiffRangeTurn.ORIGIN:
        changes.forEach(({ modified, original }) => {
          this.addRange(original as LineRange, modified as LineRange);
        });
        break;
      case EDiffRangeTurn.MODIFIED:
        changes.forEach(({ modified, original }) => {
          this.addRange(modified as LineRange, original as LineRange);
        });
        break;
    }
  }

  /**
   * 将 range 之后的所有 range 都增量 offset
   * @param range 目标 range
   * @param offset 有增有减
   * @param isContainSelf 是否包含自己，也增量 offset
   * @returns
   */
  public deltaAdjacentQueueAfter(range: LineRange, offset: number, isContainSelf = false): void {
    const oppositeRange = this.adjacentComputeRangeMap.get(range.id);
    if (!oppositeRange) {
      return;
    }

    for (const [key, pick] of this.adjacentComputeRangeMap.entries()) {
      if (pick.isAfter(oppositeRange)) {
        this.adjacentComputeRangeMap.set(key, pick.delta(offset));
      } else if (isContainSelf && pick.id === oppositeRange.id) {
        this.adjacentComputeRangeMap.set(key, pick.delta(offset));
      }
    }
  }

  public deltaEndAdjacentQueue(oppositeRange: LineRange, offset: number): void {
    for (const [key, pick] of this.adjacentComputeRangeMap.entries()) {
      if (pick.id === oppositeRange.id) {
        this.adjacentComputeRangeMap.set(key, oppositeRange.deltaEnd(offset));
        // 将在 oppositeRange 之后的 range offset 都增加
      } else if (pick.isAfter(oppositeRange)) {
        this.adjacentComputeRangeMap.set(key, pick.delta(offset));
      }
    }
  }

  public clear(): void {
    this.computeRangeMap.clear();
    this.adjacentComputeRangeMap.clear();
  }

  public deleteRange(range: LineRange): void {
    this.computeRangeMap.delete(range.id);
    this.adjacentComputeRangeMap.delete(range.id);
  }

  public addRange(newRange: LineRange, adjacentRange: LineRange): void {
    this.computeRangeMap.set(newRange.id, newRange);
    this.adjacentComputeRangeMap.set(newRange.id, adjacentRange);
  }

  /**
   * 寻找下一个离 oppositeRange 最近的 oppositeRange 点
   * @param oppositeRange 对位 lineRange，不一定存在于 map 中
   * @returns 下一个最近的 lineRange
   */
  public findNextOppositeRange(oppositeRange: LineRange): LineRange | undefined {
    const values = this.ensureSort(this.adjacentComputeRangeMap.values());

    for (const range of values) {
      if (range.id !== oppositeRange.id && range.isAfter(oppositeRange)) {
        return range;
      }
    }

    return undefined;
  }

  /**
   * 找出 oppositeRange 是否被包裹在哪一个 lineRange 里，如果有并返回该 lineRange
   */
  public findIncludeRange(oppositeRange: LineRange): LineRange | undefined {
    const values = this.ensureSort(this.adjacentComputeRangeMap.values());

    for (const range of values) {
      if (range.isInclude(oppositeRange)) {
        return range;
      }
    }

    return undefined;
  }

  /**
   * 找出 oppositeRange 是否与哪一个 lineRange 接触
   * @param isAllowContact: 是否将表面接触的 range 也认为是 touch
   */
  public findTouchesRange(oppositeRange: LineRange, isAllowContact = true): LineRange | undefined {
    const values = this.ensureSort(this.adjacentComputeRangeMap.values());

    for (const range of values) {
      const condition = () => {
        if (isAllowContact) {
          return range.isTouches(oppositeRange) || range.isContact(oppositeRange);
        }
        return range.isTouches(oppositeRange) && !range.isContact(oppositeRange);
      };

      if (condition()) {
        return range;
      }
    }

    return undefined;
  }
}
