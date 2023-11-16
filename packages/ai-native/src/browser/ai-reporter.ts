import { Injectable, Autowired } from '@opensumi/di';
import { IReporterService, uuid } from '@opensumi/ide-core-common';

import { ReportInfo, IAIReporter, AI_REPORTER_NAME, AISerivceType } from '../common';

@Injectable()
export class AIReporter implements IAIReporter {
  @Autowired(IReporterService)
  readonly reporter: IReporterService;

  private reportInfoCache: Map<string, ReportInfo> = new Map();

  private reporterCancelHandler: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private getRelationId() {
    return uuid();
  }
  // 集成方自定义上报内容
  getCommonReportInfo() {
    return {};
  }

  // 返回关联 ID
  start(msg: AISerivceType, data: ReportInfo): string {
    const relationId = this.getRelationId();

    this.report(relationId, { ...data, msgType: msg, isStart: true });

    // 这里做个兜底，如果 60s 模型还没有返回结果，上报失败
    const cancleHanddler = setTimeout(() => {
      this.report(relationId, { ...data, success: false });
    }, 60 * 1000);

    this.reporterCancelHandler.set(relationId, cancleHanddler);
    return relationId;
  }

  end(relationId: string, data: ReportInfo) {
    const cancleHanddler = this.reporterCancelHandler.get(relationId);
    if (cancleHanddler) {
      clearTimeout(cancleHanddler);
    }

    this.report(relationId, { ...data, success: true, isStart: false });
  }

  private report(relationId: string, data: ReportInfo) {
    const reportInfoCache = this.reportInfoCache.get(relationId) || {};

    const reportInfo = {
      ...this.getCommonReportInfo(),
      ...reportInfoCache,
      ...data,
      relationId,
    };

    this.reportInfoCache.set(relationId, reportInfo);
    this.reporter.point(AI_REPORTER_NAME, data.msgType, reportInfo);
  }
}
