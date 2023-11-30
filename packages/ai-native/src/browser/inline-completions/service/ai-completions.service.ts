import { Injectable, Autowired } from '@opensumi/di';
import { IStatusBarService, StatusBarAlignment } from '@opensumi/ide-core-browser';
import { CancellationTokenSource, Disposable } from '@opensumi/ide-core-common';

import { AiBackSerivcePath, IAiBackService, IAiReportCompletionOption } from '../../../common';
import { CompletionRequestBean } from '../model/competionModel';

@Injectable()
export class AiCompletionsService extends Disposable {
  static readonly STATUS_ID = 'ai_completion_status';

  @Autowired(AiBackSerivcePath)
  private readonly aiBackService: IAiBackService;

  @Autowired(IStatusBarService)
  private readonly statusBarService: IStatusBarService;

  private cancelIndicator = new CancellationTokenSource();
  // 是否显示了 inline 补全
  private isVisibleCompletion = false;
  private reportTimeout: number;
  private lastSessionId: string;

  public async complete(data: CompletionRequestBean) {
    return await this.aiBackService.requestCompletion(data as any, this.cancelIndicator.token);
  }

  public async report(data: IAiReportCompletionOption) {
    this.aiBackService.reportCompletion(data);
    this.isVisibleCompletion = false;
  }

  public setVisibleCompletion(visible: boolean) {
    if (this.reportTimeout) {
      clearTimeout(this.reportTimeout);
    }

    // 如何之前是 true，现在是 false，说明并没有进行采纳
    if (this.isVisibleCompletion === true && visible === false) {
      this.report({ sessionId: this.lastSessionId, accept: false });
    }

    if (visible === true) {
      this.reportTimeout = setTimeout(() => {
        this.isVisibleCompletion = visible;
      }, 750) as unknown as number;
    } else {
      this.isVisibleCompletion = false;
    }
  }

  public setLastSessionId(sessionId: string) {
    this.lastSessionId = sessionId;
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
