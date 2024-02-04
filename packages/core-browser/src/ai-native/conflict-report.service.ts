import { Autowired, Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { AiNativeConfigService } from './ai-config.service';
import { AISerivceType, IAIReporter, MergeConflictRT } from './reporter';

@Injectable()
export class MergeConflictReportService extends Disposable {
  @Autowired(AiNativeConfigService)
  private readonly aiNativeConfigService: AiNativeConfigService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private reportInfoMap: Map<string, Partial<MergeConflictRT>> = new Map();
  private unique2RelationMap: Map<string, string> = new Map();

  private startPoint(mode: MergeConflictRT['editorMode'] = 'traditional', isPoint = true): string {
    if (!this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      return '';
    }

    const relationId = this.aiReporter.start(
      AISerivceType.MergeConflict,
      {
        msgType: AISerivceType.MergeConflict,
        message: AISerivceType.MergeConflict,
        editorMode: mode,
      },
      isPoint,
    );

    return relationId;
  }

  public report(uniqueId: string, rt: Partial<Exclude<MergeConflictRT, 'type'>>, isPoint = true): void {
    if (!this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      return;
    }

    let relationId = '';

    if (this.unique2RelationMap.has(uniqueId)) {
      relationId = this.unique2RelationMap.get(uniqueId)!;
    } else {
      relationId = this.startPoint(rt.editorMode, isPoint);
      this.unique2RelationMap.set(uniqueId, relationId);
    }
    this.aiReporter.end(relationId, rt, isPoint);
  }

  public reportClickNum(uniqueId: string, type: 'clickAllNum' | 'clickNum', isPoint = true): void {
    const relationId = this.unique2RelationMap.get(uniqueId)!;

    if (!relationId) {
      return;
    }

    const preClickNum = this.aiReporter.getCacheReportInfo<MergeConflictRT>(relationId)![type] || 0;

    this.report(
      uniqueId,
      {
        [type]: preClickNum + 1,
      },
      isPoint,
    );
  }

  dispose(): void {
    super.dispose();
    this.reportInfoMap.clear();
  }
}
