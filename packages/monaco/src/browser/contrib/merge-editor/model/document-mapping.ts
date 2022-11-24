import { Injectable, Optional } from '@opensumi/di';
import { Disposable, match } from '@opensumi/ide-core-common';

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
  #computeResultRangeMapping: LineRangeMapping[] = [];
  public sameComputeResultRange: Map<string, LineRange> = new Map();

  private get editor(): ICodeEditor {
    return this.codeEditor.getEditor();
  }

  constructor(
    @Optional() private readonly codeEditor: BaseCodeEditor,
    @Optional() private readonly diffRangeTurn: EDiffRangeTurn,
  ) {
    super();
  }

  private reverse(id: string): string {
    const entries = this.sameComputeResultRange.entries();
    for (const pack of entries) {
      const [k, v] = pack;
      if (v.id === id) {
        return k;
      }
    }
    return '';
  }

  private updateComputeResultRangeMapping(): void {}

  public inputComputeResultRangeMapping(changes: LineRangeMapping[]): void {
    this.#computeResultRangeMapping = changes;

    const [originalRange, modifiedRange] = [flatOriginal(changes), flatModified(changes)];

    if (this.diffRangeTurn === EDiffRangeTurn.MODIFIED) {
      originalRange.forEach((range, idx) => {
        this.sameComputeResultRange.set(range.id, modifiedRange[idx]);
      });
    } else if (this.diffRangeTurn === EDiffRangeTurn.ORIGIN) {
      modifiedRange.forEach((range, idx) => {
        this.sameComputeResultRange.set(range.id, originalRange[idx]);
      });
    }
  }

  public get computeResultRangeMapping(): LineRangeMapping[] {
    return this.#computeResultRangeMapping;
  }

  public delta(range: LineRange, offset: number): void {
    const turnRanges = this.sameComputeResultRange.values();

    const pickAfterRanges = Array.from(turnRanges).filter((r) => r.isAfter(range));

    if (pickAfterRanges.length > 0) {
      pickAfterRanges.forEach((pick) => {
        const sameId = this.reverse(pick.id);
        if (this.sameComputeResultRange.has(sameId)) {
          this.sameComputeResultRange.set(sameId, pick.delta(offset));
        }
      });
    }
  }
}
