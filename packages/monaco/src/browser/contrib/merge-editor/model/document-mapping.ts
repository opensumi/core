import { Injectable, Optional } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { EDiffRangeTurn } from '../types';
import { flatModified, flatOriginal } from '../utils';

import { LineRange } from './line-range';
import { LineRangeMapping } from './line-range-mapping';

/**
 * 反映在文档上的 LineRangeMapping 映射关系
 * editor 视图要渲染的 decoration 也是从这里拿到源数据
 * conflict actions 的各种操作如 accept current 或 ignore 等也需要计算该源数据，因为当触发 accept 后，result 视图的文本内容受到改变后，同位的映射关系位置也会发生变化
 * 例: 点击左侧视图的 accept 操作，导致 result 视图的文本增加了 3 行（e.g 第 3 行到第 6 行增加了文本）, 那么这第 3 行之后的所有源数据的 lineRange offset 都需要增加 3
 * 这样再后续处理其他的 conflict 操作时才能计算正确
 *
 * @param diffRangeTurn
 * ORIGIN: 表示 current editor view 与 result editor view 的 lineRangeMapping 映射关系
 * MODIFIED: 表示 result editor view 与 incoming editor view 的 lineRangeMapping 映射关系
 */
@Injectable({ multiple: false })
export class DocumentMapping extends Disposable {
  public adjacentComputeRangeMap: Map<string, LineRange> = new Map();
  public computeRangeMap: Map<string, LineRange> = new Map();

  constructor(@Optional() private readonly diffRangeTurn: EDiffRangeTurn) {
    super();
  }

  public getOriginalRange(): LineRange[] {
    return Array.from(
      this.diffRangeTurn === EDiffRangeTurn.ORIGIN
        ? this.computeRangeMap.values()
        : this.adjacentComputeRangeMap.values(),
    );
  }

  public getModifiedRange(): LineRange[] {
    return Array.from(
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

  public inputComputeResultRangeMapping(changes: LineRangeMapping[]): void {
    const [originalRange, modifiedRange] = [flatOriginal(changes), flatModified(changes)];

    if (this.diffRangeTurn === EDiffRangeTurn.MODIFIED) {
      modifiedRange.forEach((range, idx) => {
        this.addRange(range, originalRange[idx]);
      });
    } else if (this.diffRangeTurn === EDiffRangeTurn.ORIGIN) {
      originalRange.forEach((range, idx) => {
        this.addRange(range, modifiedRange[idx]);
      });
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
    const sameRange = this.adjacentComputeRangeMap.get(range.id);
    if (!sameRange) {
      return;
    }

    for (const [key, pick] of this.adjacentComputeRangeMap.entries()) {
      if (pick.isAfter(sameRange)) {
        this.adjacentComputeRangeMap.set(key, pick.delta(offset));
      } else if (isContainSelf && pick.id === sameRange.id) {
        this.adjacentComputeRangeMap.set(key, pick.delta(offset));
      }
    }
  }

  public deltaEndAdjacentQueue(sameRange: LineRange, offset: number): void {
    for (const [key, pick] of this.adjacentComputeRangeMap.entries()) {
      if (pick.id === sameRange.id) {
        this.adjacentComputeRangeMap.set(key, sameRange.deltaEnd(offset));
        // 将在 sameRange 之后的 range offset 都增加
      } else if (pick.isAfter(sameRange)) {
        this.adjacentComputeRangeMap.set(key, pick.delta(offset));
      }
    }
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
   * 寻找下一个离 sameRange 最近的 sameRange 点
   * @param sameRange 对位 lineRange，不一定存在于 map 中
   * @returns 下一个最近的 lineRange
   */
  public findNextSameRange(sameRange: LineRange): LineRange | undefined {
    const values = this.adjacentComputeRangeMap.values();

    for (const range of values) {
      if (range.id !== sameRange.id && range.isAfter(sameRange)) {
        return range;
      }
    }

    return undefined;
  }

  /**
   * 找出 sameRange 是否被包裹在哪一个 lineRange 里，如果有并返回该 lineRange
   */
  public findIncludeRange(sameRange: LineRange): LineRange | undefined {
    const values = this.adjacentComputeRangeMap.values();

    for (const range of values) {
      if (range.isInclude(sameRange)) {
        return range;
      }
    }

    return undefined;
  }

  /**
   * 找出 sameRange 是否与哪一个 lineRange 接触
   */
  public findTouchesRange(sameRange: LineRange): LineRange | undefined {
    const values = this.adjacentComputeRangeMap.values();

    for (const range of values) {
      if (range.isTouches(sameRange)) {
        return range;
      }
    }

    return undefined;
  }
}
