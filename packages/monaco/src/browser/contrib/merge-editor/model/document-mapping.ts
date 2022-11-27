import { Injectable, Optional } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { ICodeEditor } from '../../../monaco-api/types';
import { EDiffRangeTurn } from '../types';
import { flatModified, flatOriginal } from '../utils';
import { BaseCodeEditor } from '../view/editors/baseCodeEditor';

import { LineRange } from './line-range';
import { LineRangeMapping } from './line-range-mapping';

/**
 * 反映在文档上的 LineRangeMapping 映射关系
 * 所有因为 conflict-actions 的操作而导致 line range mapping 对应关系需要重新计算的任务都在该类处理
 */
@Injectable({ multiple: false })
export class DocumentMapping extends Disposable {
  public adjacentComputeRangeMap: Map<string, LineRange> = new Map();
  public computeRangeMap: Map<string, LineRange> = new Map();

  private get editor(): ICodeEditor {
    return this.codeEditor.getEditor();
  }

  constructor(
    @Optional() private readonly codeEditor: BaseCodeEditor,
    @Optional() private readonly diffRangeTurn: EDiffRangeTurn,
  ) {
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

  public reverse(range: LineRange): LineRange | undefined {
    const entries = this.adjacentComputeRangeMap.entries();
    for (const pack of entries) {
      const [k, v] = pack;
      if (v.id === range.id && this.computeRangeMap.has(v.id)) {
        return this.computeRangeMap.get(v.id);
      }
    }
  }

  public inputComputeResultRangeMapping(changes: LineRangeMapping[]): void {
    const [originalRange, modifiedRange] = [flatOriginal(changes), flatModified(changes)];

    if (this.diffRangeTurn === EDiffRangeTurn.MODIFIED) {
      modifiedRange.forEach((range, idx) => {
        this.computeRangeMap.set(range.id, range);
        this.adjacentComputeRangeMap.set(range.id, originalRange[idx]);
      });
    } else if (this.diffRangeTurn === EDiffRangeTurn.ORIGIN) {
      originalRange.forEach((range, idx) => {
        this.computeRangeMap.set(range.id, range);
        this.adjacentComputeRangeMap.set(range.id, modifiedRange[idx]);
      });
    }
  }

  public deltaAdjacentQueue(range: LineRange, offset: number): void {
    const sameRange = this.adjacentComputeRangeMap.get(range.id);

    for (const [key, pick] of this.adjacentComputeRangeMap.entries()) {
      if (sameRange && pick.isAfter(sameRange)) {
        this.adjacentComputeRangeMap.set(key, pick.delta(offset));
      }
    }
  }
}
