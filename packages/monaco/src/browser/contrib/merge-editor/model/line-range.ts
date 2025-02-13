import { Constants, uuid } from '@opensumi/ide-core-common';
import { LineRange as MonacoLineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import { Range as MonacoRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { ECompleteReason, ETurnDirection, IRangeContrast, LineRangeType } from '../types';

import { InnerRange } from './inner-range';

export interface IIntelligentState {
  isLoading: boolean;
  isComplete: boolean;
  answerCode: string;
}

class IntelligentStateModel implements IIntelligentState {
  private _isLoading = false;
  private _isComplete = false;
  private _answerCode = '';

  public setAnswerCode(v: string) {
    this._answerCode = v;
    return this;
  }

  public setLoading(v: boolean): this {
    this._isLoading = v;
    return this;
  }

  public setIsComplete(v: boolean): this {
    this._isComplete = v;
    return this;
  }

  public get answerCode(): string {
    return this._answerCode;
  }

  public get isLoading(): boolean {
    return this._isLoading;
  }

  public get isComplete(): boolean {
    return this._isComplete;
  }

  public setAll(state: Partial<IIntelligentState>, isFull = true): this {
    if (isFull) {
      this.reset();
      this.setIsComplete(!!state.isComplete)
        .setLoading(!!state.isLoading)
        .setAnswerCode(state.answerCode || '');
    } else {
      if (state.isComplete !== undefined) {
        this.setIsComplete(!!state.isComplete);
      }

      if (state.isLoading !== undefined) {
        this.setLoading(!!state.isLoading);
      }

      if (state.answerCode !== undefined) {
        this.setAnswerCode(state.answerCode);
      }
    }
    return this;
  }

  public reset(): void {
    this.setLoading(false);
    this.setIsComplete(false);
    this.setAnswerCode('');
  }
}

/**
 * 如果 lineRange 是通过 merge 合并生成的
 * 则跟 merge 相关的数据状态都在该 model 来处理
 */
class MergeStateModel {
  /**
   * 存储合并前的所有 lineRange 元数据
   */
  private metaRanges: LineRange[] = [];

  /**
   * 左右的代码有重叠，有包含，有接触
   */
  public get isMerge(): boolean {
    return this.metaRanges.length > 0;
  }

  /**
   * 只有当 metaRanges 里的 range 彼此都只是表面接触时才允许 combination 操作
   * (能被 accept combination 意味着这块 diff 区域，左右两边的代码合并后不会出现被覆盖的情况)
   * 例如
   *    左边               中间               右边
   *    ```               ```               ```
   *    1. const a = 1       const a = 2       const a = 1
   *    2. const b = 1       const b = 1       const b = 2
   *    3. const c = 1       const c = 2       const c = 1
   *    ```               ```               ```
   *
   * 其中第一行中间与两边都有 diff，但不管是接受左边的还是右边的，最终对结果的影响不变（接受左右两边都一样）
   * 如果这三行都是这样的情况，则被允许 combination
   */
  public get isAllowCombination(): boolean {
    const length = this.metaRanges.length;
    if (length <= 1) {
      return false;
    }

    let slow = 0;
    for (let fast = 0; fast < length; fast++) {
      const slowRange = this.metaRanges[slow];
      const fastRange = this.metaRanges[fast];

      if (slowRange.id === fastRange.id) {
        continue;
      }

      if (!fastRange.isContact(slowRange)) {
        return false;
      }

      slow += 1;
    }

    return true;
  }

  public add(range: LineRange): this {
    this.metaRanges.push(range);
    return this;
  }

  public reset(): this {
    this.metaRanges = [];
    return this;
  }

  public has(metaRange: LineRange): boolean {
    return this.metaRanges.some((m) => m.id === metaRange.id);
  }

  public getMetaRanges(): LineRange[] {
    return this.metaRanges;
  }
}

export class LineRange extends MonacoLineRange implements IRangeContrast {
  static fromPositions(startLineNumber: number, endLineNumber: number = startLineNumber): LineRange {
    return new LineRange(startLineNumber, endLineNumber);
  }

  private _id: string;
  public get id(): string {
    return this._id;
  }

  private _type: LineRangeType;
  public get type(): LineRangeType {
    return this._type;
  }

  private _isComplete: boolean;
  private _completeReason: ECompleteReason | undefined;

  /**
   * 是否已经解决完成（是否合入）
   */
  public get isComplete(): boolean {
    return this._isComplete;
  }

  public get completeReason(): ECompleteReason {
    return this._completeReason!;
  }

  private _turnDirection: ETurnDirection;
  public get turnDirection(): ETurnDirection {
    return this._turnDirection;
  }

  /**
   * @see {@link MergeStateModel.isMerge}
   */
  public get isMerge(): boolean {
    return this.mergeStateModel.isMerge;
  }

  /**
   * @see {@link MergeStateModel.isAllowCombination}
   */
  public get isAllowCombination(): boolean {
    return this.mergeStateModel.isAllowCombination;
  }

  public get isConflictPoint(): boolean {
    return this.isMerge && this.type === 'modify';
  }

  private mergeStateModel: MergeStateModel;
  private intelligentStateModel: IntelligentStateModel;

  constructor(startLineNumber: number, endLineNumberExclusive: number) {
    super(startLineNumber, endLineNumberExclusive);
    this._isComplete = false;
    this._id = uuid(6);
    this.mergeStateModel = new MergeStateModel();
    this.intelligentStateModel = new IntelligentStateModel();
  }

  setId(id: string): this {
    this._id = id;
    return this;
  }

  public setTurnDirection(t: ETurnDirection) {
    this._turnDirection = t;
    return this;
  }

  public done(reason: ECompleteReason): this {
    this._isComplete = true;
    this._completeReason = reason;
    return this;
  }

  /**
   * 置为未完成状态
   */
  public cancel(): this {
    this._isComplete = false;
    this._completeReason = undefined;
    return this;
  }

  private setMergeStateModel(state: MergeStateModel): this {
    this.mergeStateModel = state;
    return this;
  }

  public setIntelligentStateModel(state: IntelligentStateModel): this {
    this.intelligentStateModel = state;
    return this;
  }

  public getIntelligentStateModel(): IntelligentStateModel {
    return this.intelligentStateModel;
  }

  public setType(v: LineRangeType): this {
    this._type = v;
    return this;
  }

  public isTendencyRight(refer: LineRange): boolean {
    return this.isEmpty && !refer.isEmpty;
  }

  public isTendencyLeft(refer: LineRange): boolean {
    return !this.isEmpty && refer.isEmpty;
  }

  public isAfter(range: LineRange): boolean {
    return this.startLineNumber >= range.endLineNumberExclusive;
  }

  public isBefore(range: LineRange): boolean {
    return range.startLineNumber >= this.endLineNumberExclusive;
  }

  public isTouches(range: LineRange): boolean {
    return this.endLineNumberExclusive >= range.startLineNumber && range.endLineNumberExclusive >= this.startLineNumber;
  }

  /**
   * 是否仅仅只是表面接触
   */
  public isContact(range: LineRange): boolean {
    return (
      this.startLineNumber === range.endLineNumberExclusive || this.endLineNumberExclusive === range.startLineNumber
    );
  }

  public isInclude(range: LineRange | InnerRange): boolean {
    if (range instanceof LineRange) {
      return (
        this.startLineNumber <= range.startLineNumber && this.endLineNumberExclusive >= range.endLineNumberExclusive
      );
    } else if (range instanceof InnerRange) {
      if (this.isEmpty) {
        return false;
      }
      return this.startLineNumber <= range.startLineNumber && this.endLineNumberExclusive >= range.endLineNumber;
    }
    return false;
  }

  public equals(range: MonacoLineRange): boolean {
    return this.startLineNumber === range.startLineNumber && this.length === range.length;
  }

  public get metaMergeRanges(): LineRange[] {
    return this.mergeStateModel.getMetaRanges();
  }

  public recordMergeRange(range: LineRange): this {
    this.mergeStateModel.add(range);
    return this;
  }

  /**
   * 与 other range 合并成一个 range
   * @param isKeep: 是否记录被合并的 range
   */
  public merge(other: LineRange, isKeep = true): LineRange {
    if (isKeep) {
      if (!this.mergeStateModel.has(this)) {
        this.recordMergeRange(this);
      }
      this.recordMergeRange(other);
    }

    return this.retainState(
      new LineRange(
        Math.min(this.startLineNumber, other.startLineNumber),
        Math.max(this.endLineNumberExclusive, other.endLineNumberExclusive),
      ),
    ).setTurnDirection(ETurnDirection.BOTH);
  }

  // 生一个除 id 以外，state 状态都相同的 lineRange
  public born(): LineRange {
    const child = LineRange.fromPositions(this.startLineNumber, this.endLineNumberExclusive);
    const preId = child.id;
    return this.retainState(child).setId(preId);
  }

  public toRange(startColumn?: number, endColumn?: number): InnerRange {
    return InnerRange.fromPositions(
      new Position(this.startLineNumber, startColumn ?? 1),
      new Position(this.endLineNumberExclusive, endColumn ?? 1),
    ).setType(this._type);
  }

  public toInclusiveRange(startColumn?: number, endColumn?: number): MonacoRange {
    if (this.isEmpty) {
      return InnerRange.fromPositions(
        new Position(this.startLineNumber, startColumn ?? 1),
        new Position(this.startLineNumber, endColumn ?? 1),
      ).setType(this._type);
    }
    return InnerRange.fromPositions(
      new Position(this.startLineNumber, startColumn ?? 1),
      new Position(this.endLineNumberExclusive - 1, endColumn ?? Constants.MAX_SAFE_SMALL_INTEGER),
    ).setType(this._type);
  }

  private retainState(range: LineRange): LineRange {
    const newLineRange = range
      .setId(this._id)
      .setType(this._type)
      .setTurnDirection(this._turnDirection)
      .setMergeStateModel(this.mergeStateModel)
      .setIntelligentStateModel(this.intelligentStateModel);

    if (this._isComplete) {
      newLineRange.done(this._completeReason!);
    } else {
      newLineRange.cancel();
    }

    return newLineRange;
  }

  public override delta(offset: number): LineRange {
    return this.retainState(new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive + offset));
  }

  public deltaStart(offset: number): LineRange {
    return this.retainState(new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive));
  }

  public deltaEnd(offset: number): LineRange {
    return this.retainState(new LineRange(this.startLineNumber, this.endLineNumberExclusive + offset));
  }
}
