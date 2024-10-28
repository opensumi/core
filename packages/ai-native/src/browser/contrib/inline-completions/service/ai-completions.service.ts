import { Autowired, Injectable } from '@opensumi/di';
import { IStatusBarService, StatusBarAlignment } from '@opensumi/ide-core-browser';
import {
  AIBackSerivcePath,
  ActionSourceEnum,
  ActionTypeEnum,
  CancellationTokenSource,
  Disposable,
  Emitter,
  Event,
  IAIBackService,
  IAICompletionOption,
  IAICompletionResultModel,
  IAIReportCompletionOption,
} from '@opensumi/ide-core-common';
import { CompletionRT, IAIReporter } from '@opensumi/ide-core-common/lib/types/ai-native/reporter';

import { IIntelligentCompletionsResult } from '../../intelligent-completions';

@Injectable()
export class AICompletionsService extends Disposable {
  static readonly STATUS_ID = 'ai_completion_status';

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(IStatusBarService)
  private readonly statusBarService: IStatusBarService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private readonly _onVisibleCompletion = new Emitter<boolean>();
  public readonly onVisibleCompletion: Event<boolean> = this._onVisibleCompletion.event;

  private cancelIndicator = new CancellationTokenSource();
  // 是否使用默认的补全模型
  protected isDefaultCompletionModel = true;
  // 是否显示了 inline 补全
  private _isVisibleCompletion = false;
  // 会话 id
  private lastSessionId: string;
  // 统计 id
  private lastRelationId: string;
  private lastRenderTime: number;
  private lastCompletionUseTime: number;
  // 补全内容
  private lastCompletionContent: string;

  protected validCompletionThreshold = 750;

  private recordRenderTime(): void {
    this.lastRenderTime = Date.now();
  }

  private recordCompletionUseTime(preTime: number): void {
    this.lastCompletionUseTime = Date.now() - preTime;
  }

  public get isVisibleCompletion(): boolean {
    return this._isVisibleCompletion;
  }

  public async complete(data: IAICompletionOption): Promise<IIntelligentCompletionsResult | undefined> {
    this.isDefaultCompletionModel = true;
    const completionStart = Date.now();

    // 兼容旧的 requestCompletion 接口
    try {
      const result = (await this.aiBackService.requestCompletion?.(
        data,
        this.cancelIndicator.token,
      )) as IAICompletionResultModel;
      this.recordCompletionUseTime(completionStart);

      const { sessionId, codeModelList, isCancel } = result;

      return {
        items: codeModelList.map((model) => ({ ...model, insertText: model.content })),
        extra: {
          sessionId,
          isCancel,
        },
      };
    } catch (error) {
      return;
    }
  }

  public async report(data: IAIReportCompletionOption) {
    const { relationId, accept } = data;

    data.renderingTime = Date.now() - this.lastRenderTime;
    data.completionUseTime = this.lastCompletionUseTime;
    this.reporterEnd(relationId, {
      success: true,
      isReceive: accept,
      renderingTime: data.renderingTime,
      code: data.code,
      actionSource: ActionSourceEnum.Completion,
      actionType: ActionTypeEnum.Completion,
    });

    this._isVisibleCompletion = false;
  }

  public async reporterEnd(relationId: string, data: CompletionRT) {
    const reportData = {
      ...data,
      isValid: typeof data.renderingTime === 'number' ? data.renderingTime > this.validCompletionThreshold : false,
    };
    // 排除掉无效数据，避免多余数据上报
    if (reportData.isValid) {
      this.aiReporter.end(relationId, reportData);
    }
  }

  public setVisibleCompletion(visible: boolean) {
    // 如果之前是 true，现在是 false，说明并没有进行采纳
    if (this._isVisibleCompletion === true && visible === false) {
      this.report({
        sessionId: this.lastSessionId,
        accept: false,
        relationId: this.lastRelationId,
        code: this.lastCompletionContent,
      });
    }

    this._isVisibleCompletion = visible;

    this._onVisibleCompletion.fire(visible);

    if (visible === true) {
      this.recordRenderTime();
    }
  }

  public setLastSessionId(sessionId: string) {
    this.lastSessionId = sessionId;
  }

  public setLastRelationId(relationId: string) {
    this.lastRelationId = relationId;
  }

  public setLastCompletionContent(content: string) {
    this.lastCompletionContent = content;
  }

  public async cancelRequest() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  public updateStatusBarItem(content: string, isLoading: boolean) {
    const text = isLoading ? `$(loading~spin) ${content}` : `$(magic-wand) ${content}`;

    this.statusBarService.addElement(AICompletionsService.STATUS_ID, {
      text,
      alignment: StatusBarAlignment.RIGHT,
      priority: 1,
    });
  }

  public hideStatusBarItem() {
    this.statusBarService.removeElement(AICompletionsService.STATUS_ID);
  }
}
