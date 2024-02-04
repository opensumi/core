import { Autowired, Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { AISerivceType, IAIReporter, MergeConflictRT } from '@opensumi/ide-core-common/lib/ai-native/reporter';

import { AiNativeConfigService } from './ai-config.service';

@Injectable()
export class MergeConflictReportService extends Disposable {
  @Autowired(AiNativeConfigService)
  private readonly aiNativeConfigService: AiNativeConfigService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private reportInfoMap: Map<string, Partial<MergeConflictRT>> = new Map();
  private unique2RelationMap: Map<string, string> = new Map();

  public record(
    uniqueId: string,
    rt: Partial<Exclude<MergeConflictRT, 'type'>>,
  ): Partial<MergeConflictRT> & { relationId?: string } {
    if (this.aiNativeConfigService.capabilities.supportsConflictResolve === false) {
      return rt;
    }

    let relationId = '';

    if (this.unique2RelationMap.has(uniqueId)) {
      relationId = this.unique2RelationMap.get(uniqueId)!;
      this.aiReporter.record(rt, relationId);
    } else {
      relationId = this.aiReporter.record({
        ...rt,
        msgType: AISerivceType.MergeConflict,
        message: AISerivceType.MergeConflict,
        editorMode: rt.editorMode || 'traditional',
      }).relationId!;
      this.unique2RelationMap.set(uniqueId, relationId);
    }

    return {
      ...rt,
      relationId,
    };
  }

  public report(uniqueId: string, rt: Partial<Exclude<MergeConflictRT, 'type'>>): void {
    if (this.aiNativeConfigService.capabilities.supportsConflictResolve === false) {
      return;
    }

    const reportInfo = this.record(uniqueId, rt);
    this.aiReporter.end(reportInfo.relationId!, reportInfo);
  }

  public reportClickNum(uniqueId: string, type: 'clickAllNum' | 'clickNum'): void {
    if (this.aiNativeConfigService.capabilities.supportsConflictResolve === false) {
      return;
    }
    const relationId = this.unique2RelationMap.get(uniqueId)!;

    if (!relationId) {
      return;
    }

    const preClickNum = this.aiReporter.getCacheReportInfo<MergeConflictRT>(relationId)![type] || 0;

    this.report(uniqueId, {
      [type]: preClickNum + 1,
    });
  }

  dispose(): void {
    super.dispose();
    this.reportInfoMap.clear();
  }
}
