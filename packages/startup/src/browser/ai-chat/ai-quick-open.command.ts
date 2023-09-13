import { Injectable, Autowired } from '@opensumi/di';
import { Mode } from '@opensumi/ide-core-browser';
import { QuickOpenItem } from '@opensumi/ide-core-browser';
import { MaybePromise, QuickOpenHandler, QuickOpenModel, QuickOpenOptions, QuickOpenTabOptions } from '@opensumi/ide-core-browser';

import { AiChatService } from './ai-chat.service';

@Injectable()
export class AiQuickCommandHandler implements QuickOpenHandler {
  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  private items: QuickOpenItem[];
  default?: boolean | undefined = true;
  prefix = '/ ';
  description = 'AI 助手';
  init?(): MaybePromise<void> {
  }
  getModel(): QuickOpenModel {
    return {
      onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => {
        acceptor([
          new QuickOpenItem({
            label: '$(git-pull-request-create)  创建合并请求',
            run: (mode: Mode) => {
              if (mode === Mode.OPEN) {
                this.aiChatService.launchChatMessage('创建 合并请求');
                return true;
              }
              return false;
            },
          }),
          new QuickOpenItem({
            label: '$(repo-push)  提交代码',
            run: () => false,
          }),
          new QuickOpenItem({
            label: '$(record)  代码扫描',
            run: () => false,
          }),
          new QuickOpenItem({
            label: '$(circuit-board)  触发流水线',
            run: () => false,
          }),
          new QuickOpenItem({
            label: '$(code)  部署 dev',
            run: () => false,
          }),
          new QuickOpenItem({
            label: '$(preview)  部署预发',
            run: () => false,
          }),
          new QuickOpenItem({
            label: '——'.repeat(30),
            run: () => false,
          }),
          new QuickOpenItem({
            label: '代码搜索: ',
            run: () => false,
          }),
        ]);
      },
    };
  }
  getOptions(): Omit<Partial<QuickOpenOptions.Resolved>, keyof QuickOpenTabOptions> {
    return {

    };
  }
  onClose?: ((canceled: boolean) => void) | undefined;
  onToggle?: (() => void) | undefined;
}
