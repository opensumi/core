import { Autowired, Injectable } from '@opensumi/di';
import { IReporterService, uuid } from '@opensumi/ide-core-common';
import {
  AIServiceType,
  AI_REPORTER_NAME,
  IAIReporter,
  ReportInfo,
} from '@opensumi/ide-core-common/lib/types/ai-native/reporter';

@Injectable()
export class AIReporter implements IAIReporter {
  @Autowired(IReporterService)
  readonly reporter: IReporterService;

  private reportInfoCache: Map<string, ReportInfo> = new Map();
  private reporterCancelHandler: Map<string, ReturnType<typeof setTimeout>> = new Map();

  getRelationId() {
    return uuid();
  }

  public getCacheReportInfo<ReportInfo>(relationId: string) {
    return this.reportInfoCache.get(relationId) as ReportInfo;
  }

  // 集成方自定义上报内容
  getCommonReportInfo() {
    return {};
  }

  // 返回关联 ID
  start(msg: AIServiceType, data: ReportInfo, timeout = 60 * 1000): string {
    const relationId = this.getRelationId();

    this.report(relationId, { ...data, msgType: msg, isStart: true });

    // 这里做个兜底，如果 60s 模型还没有返回结果，上报失败
    const cancleHanddler = setTimeout(() => {
      this.report(relationId, { ...data, success: false });
    }, timeout);

    this.reporterCancelHandler.set(relationId, cancleHanddler);
    return relationId;
  }

  end(relationId: string, data: ReportInfo) {
    const cancleHanddler = this.reporterCancelHandler.get(relationId);
    if (cancleHanddler) {
      clearTimeout(cancleHanddler);
    }

    this.report(relationId, { success: true, ...data, isStart: false });
  }

  public send(data: ReportInfo) {
    this.reporter.point(AI_REPORTER_NAME, data.msgType, data);
  }

  // 记录数据但不上报
  public record(data: ReportInfo, relationId?: string): ReportInfo {
    if (!relationId) {
      relationId = this.getRelationId();
    }

    const reportInfoCache = this.reportInfoCache.get(relationId) || {};

    const reportInfo = {
      ...this.getCommonReportInfo(),
      ...reportInfoCache,
      ...data,
      relationId,
    };

    this.reportInfoCache.set(relationId, reportInfo);
    return reportInfo;
  }

  private report(relationId: string, data: ReportInfo) {
    const reportInfo = this.record(data, relationId);
    this.reporter.point(AI_REPORTER_NAME, data.msgType || reportInfo.msgType, reportInfo);
  }
}
