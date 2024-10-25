import { Autowired, Injectable } from '@opensumi/di';
import {
  AIServiceType,
  Disposable,
  IAIReporter,
  MergeConflictEditorMode,
  MergeConflictRT,
} from '@opensumi/ide-core-common';

import { AINativeConfigService } from './ai-config.service';

@Injectable()
export class MergeConflictReportService extends Disposable {
  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private reportInfoMap: Map<string, Partial<MergeConflictRT>> = new Map();
  private unique2RelationMap: Map<string, string> = new Map();

  public record(
    uniqueId: string,
    rt: Partial<Exclude<MergeConflictRT, 'type'>>,
  ): Partial<MergeConflictRT> & { relationId?: string } {
    if (!this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      return rt;
    }

    let relationId = '';

    if (this.unique2RelationMap.has(uniqueId)) {
      relationId = this.unique2RelationMap.get(uniqueId)!;
      this.aiReporter.record(rt, relationId);
    } else {
      relationId = this.aiReporter.record({
        ...rt,
        msgType: AIServiceType.MergeConflict,
        message: AIServiceType.MergeConflict,
        editorMode: rt.editorMode || MergeConflictEditorMode.traditional,
      }).relationId!;
      this.unique2RelationMap.set(uniqueId, relationId);
    }

    return {
      ...rt,
      relationId,
    };
  }

  public report(uniqueId: string, rt: Partial<Exclude<MergeConflictRT, 'type'>>): void {
    if (!this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      return;
    }

    const reportInfo = this.record(uniqueId, rt);
    this.aiReporter.end(reportInfo.relationId!, reportInfo);
  }

  public reportIncrementNum(uniqueId: string, type: 'clickAllNum' | 'clickNum' | 'aiOutputNum' | 'cancelNum'): void {
    if (!this.aiNativeConfigService.capabilities.supportsConflictResolve) {
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
