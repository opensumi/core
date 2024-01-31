import { Autowired, Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { AISerivceType, AiNativeConfigService, IAIReporter, MergeConflictRT } from './index';

@Injectable()
export class MergeConflictReportService extends Disposable {
  @Autowired(AiNativeConfigService)
  private readonly aiNativeConfigService: AiNativeConfigService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private reportInfoMap: Map<string, Partial<MergeConflictRT>> = new Map();

  public startPoint(mode: MergeConflictRT['editorMode'] = 'traditional'): string {
    if (!this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      return '';
    }

    const relationId = this.aiReporter.start(AISerivceType.MergeConflict, {
      msgType: AISerivceType.MergeConflict,
      message: AISerivceType.MergeConflict,
      editorMode: mode,
    });

    this.reportInfoMap.set(relationId, {});

    return relationId;
  }

  public reportPoint(relationId: string, rt: Partial<Exclude<MergeConflictRT, 'type'>>): void {
    let reportInfo = this.reportInfoMap.get(relationId);

    if (!reportInfo) {
      reportInfo = {};
    }

    const newReportInfo = {
      ...reportInfo,
      ...rt,
    };

    this.reportInfoMap.set(relationId, newReportInfo);
    this.aiReporter.end(relationId, newReportInfo);
  }

  // 点击次数加 1
  public reportClickNum(relationId: string): void {
    let reportInfo = this.reportInfoMap.get(relationId);

    if (!reportInfo) {
      reportInfo = { clickNum: 0 };
    }

    this.reportPoint(relationId, {
      clickNum: (reportInfo.clickNum || 0) + 1,
    });
  }

  dispose(): void {
    super.dispose();
    this.reportInfoMap.clear();
  }
}
