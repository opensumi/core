import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId, WithEventBus, raceCancellation, sleep } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';

import { IAIInlineCompletionsProvider } from '../../../common';

import { IInlineCompletionCache } from './model/competionModel';
import { InlineCompletionRequestTask } from './model/inlineCompletionRequestTask';
import { AICompletionsService } from './service/ai-completions.service';

// 用来缓存最近一次的补全结果
const inlineCompletionCache: IInlineCompletionCache = {
  line: -1,
  column: -1,
  last: null,
};

class ReqStack {
  queue: InlineCompletionRequestTask[];
  constructor() {
    this.queue = [];
  }
  addReq(reqRequest: InlineCompletionRequestTask) {
    this.queue.push(reqRequest);
  }
  runReq() {
    if (this.queue.length === 0) {
      return;
    }
    const fn = this.queue.pop()!;
    return fn.run();
  }
  cancelReq() {
    if (this.queue.length === 0) {
      return;
    }
    this.queue.forEach((item) => {
      item.cancelRequest();
    });
    this.queue = [];
  }
}

@Injectable()
export class AIInlineCompletionsProvider extends WithEventBus implements IAIInlineCompletionsProvider {
  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  /**
   * 该补全是否是手动触发
   */
  isManual: boolean;

  isDelEvent: boolean;
  reqStack: ReqStack;
  inlineComletionsDebounceTime: number;

  constructor() {
    super();

    this.inlineComletionsDebounceTime = this.preferenceService.getValid(
      AINativeSettingSectionsId.IntelligentCompletionsDebounceTime,
      150,
    );

    this.addDispose(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.IntelligentCompletionsDebounceTime,
        ({ newValue }) => {
          this.inlineComletionsDebounceTime = newValue;
        },
      ),
    );

    this.mount();
  }

  public mount(): void {
    this.isManual = false;
    this.isDelEvent = false;
    this.reqStack = new ReqStack();
  }

  setVisibleCompletion(visible: boolean) {
    this.aiCompletionsService.setVisibleCompletion(visible);
  }

  hideStatusBarItem() {
    this.aiCompletionsService.hideStatusBarItem();
  }

  cancelRequest() {
    this.aiCompletionsService.cancelRequest();
    if (this.reqStack) {
      this.reqStack.cancelReq();
    }
  }

  /**
   * 用户触发编辑器后，事件的回调
   * @param document
   * @param position
   * @param context
   * @param token
   * @returns
   */
  async provideInlineCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken,
  ) {
    // bugfix: 修复当鼠标移动到代码补全上会触发一次手势事件，增加防抖，当手势触发后，能够防抖一次
    if (context.triggerKind === monaco.InlineCompletionTriggerKind.Automatic) {
      if (
        inlineCompletionCache.column === position.column &&
        inlineCompletionCache.line === position.lineNumber &&
        inlineCompletionCache.last !== undefined
      ) {
        inlineCompletionCache.column = -1;
        inlineCompletionCache.line = -1;
        return inlineCompletionCache.last;
      }
    }

    this.cancelRequest();
    this.hideStatusBarItem();

    // step 1 判断生成开关,如果关闭不进行后续操作
    const _isManual = this.isManual;
    if (this.isDelEvent && !_isManual) {
      return undefined;
    }

    // 重置防止不触发自动补全事件
    this.updateIsManual(false);

    // 放入队列
    const requestImp = this.injector.get(InlineCompletionRequestTask, [model, position, token]);

    this.reqStack.addReq(requestImp);

    // 如果是自动补全需要 debounce
    if (!_isManual) {
      await raceCancellation(sleep(this.inlineComletionsDebounceTime), token);
    }

    // 如果用户已取消
    if (token?.isCancellationRequested) {
      return undefined;
    }

    const list = await this.reqStack.runReq();
    if (!list) {
      return undefined;
    }

    inlineCompletionCache.column = position.column;
    inlineCompletionCache.line = position.lineNumber;
    inlineCompletionCache.last = {
      items: list,
    };
    return inlineCompletionCache.last;
  }

  updateIsManual(val: boolean) {
    this.isManual = val;
  }
}
