import { ITimeMachineMetaData } from '../types';

/**
 * 用于 revoke 操作
 * 记录 result editor 视图当中所有 diff range 区域最原始的代码内容
 * 后续执行撤销操作时，将该区域内的代码内容和 range 状态都回到最原始的状态
 */
export class TimeMachineDocument {
  private collectMap: Map<string, ITimeMachineMetaData>;

  constructor() {
    this.collectMap = new Map();
  }

  public record(rangeId: string, data: ITimeMachineMetaData): void {
    if (!this.collectMap.has(rangeId)) {
      this.collectMap.set(rangeId, data);
    }
  }

  public getMetaData(rangeId: string): ITimeMachineMetaData | undefined {
    return this.collectMap.get(rangeId);
  }
}
