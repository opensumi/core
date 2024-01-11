import { Injectable, Autowired } from '@opensumi/di';
import { IStatusBarService, StatusBarAlignment } from '@opensumi/ide-core-browser';
import { CancellationTokenSource, Disposable } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  AiBackSerivcePath,
  Completion,
  IAiBackService,
  IAiReportCompletionOption,
  IAIReporter,
  ReportInfo,
} from '../../../common';
import { IAiMiddleware, IProvideInlineCompletionsSignature } from '../../types';
import { CompletionRequestBean, CompletionResultModel } from '../model/competionModel';

@Injectable()
export class AiCompletionsService extends Disposable {
  static readonly STATUS_ID = 'ai_completion_status';

  @Autowired(AiBackSerivcePath)
  private readonly aiBackService: IAiBackService;

  @Autowired(IStatusBarService)
  private readonly statusBarService: IStatusBarService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private cancelIndicator = new CancellationTokenSource();
  // 是否使用默认的补全模型
  protected isDefaultCompletionModel = true;
  // 是否显示了 inline 补全
  private isVisibleCompletion = false;
  // 会话 id
  private lastSessionId: string;
  // 统计 id
  private lastRelationId: string;
  private lastRenderTime: number;
  private lastCompletionUseTime: number;
  // 中间间拓展 inlinecompletion
  private lastMiddlewareInlineCompletion?: IProvideInlineCompletionsSignature;

  private recordRenderTime(): void {
    this.lastRenderTime = Date.now();
  }

  private recordCompletionUseTime(preTime: number): void {
    this.lastCompletionUseTime = Date.now() - preTime;
  }

  public async complete(data: CompletionRequestBean, model, position, token): Promise<CompletionResultModel | null> {
    const doCompletion = async (data: CompletionRequestBean) => {
      try {
        this.isDefaultCompletionModel = true;
        const now = Date.now();
        const result = (await this.aiBackService.requestCompletion(
          data as any,
          this.cancelIndicator.token,
        )) as unknown as CompletionResultModel;
        this.recordCompletionUseTime(now);
        return result;
      } catch (error) {
        return null;
      }
    };

    if (this.lastMiddlewareInlineCompletion) {
      this.isDefaultCompletionModel = false;
      return this.lastMiddlewareInlineCompletion(model, position, token, doCompletion, data);
    }

    return doCompletion(data);
  }

  public setMiddlewareComplete(provideInlineCompletions: IProvideInlineCompletionsSignature): void {
    this.lastMiddlewareInlineCompletion = provideInlineCompletions;
  }

  public async report(data: IAiReportCompletionOption) {
    const { relationId, accept } = data;

    data.renderingTime = Date.now() - this.lastRenderTime;
    data.completionUseTime = this.lastCompletionUseTime;
    this.aiBackService.reportCompletion(data);
    this.reporterEnd(relationId, { success: true, isReceive: accept, renderingTime: data.renderingTime });

    this.isVisibleCompletion = false;
  }

  public async reporterEnd(relationId: string, data: Completion) {
    this.aiReporter.end(relationId, {
      ...data,
      isValid: typeof data.renderingTime === 'number' ? data.renderingTime > 750 : false,
    });
  }

  public setVisibleCompletion(visible: boolean) {
    // 如果之前是 true，现在是 false，说明并没有进行采纳
    if (this.isVisibleCompletion === true && visible === false) {
      this.report({ sessionId: this.lastSessionId, accept: false, relationId: this.lastRelationId });
    }

    if (visible === true) {
      this.isVisibleCompletion = visible;
      this.recordRenderTime();
    } else {
      this.isVisibleCompletion = false;
    }
  }

  public setLastSessionId(sessionId: string) {
    this.lastSessionId = sessionId;
  }

  public setLastRelationId(relationId: string) {
    this.lastRelationId = relationId;
  }

  public async cancelRequest() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  public updateStatusBarItem(content: string, isLoading: boolean) {
    const text = isLoading ? `$(loading~spin) ${content}` : `$(magic-wand) ${content}`;

    this.statusBarService.addElement(AiCompletionsService.STATUS_ID, {
      text,
      alignment: StatusBarAlignment.RIGHT,
      priority: 1,
    });
  }

  public hideStatusBarItem() {
    this.statusBarService.removeElement(AiCompletionsService.STATUS_ID);
  }
}
