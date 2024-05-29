import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AI_INLINE_COMPLETION_REPORTER } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { URI, WithEventBus, uuid } from '@opensumi/ide-core-common';
import { IAICompletionResultModel } from '@opensumi/ide-core-common/lib/types/ai-native';
import { AISerivceType, IAIReporter } from '@opensumi/ide-core-common/lib/types/ai-native/reporter';
import { IEditor } from '@opensumi/ide-editor';
import * as monaco from '@opensumi/ide-monaco';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';

import { DEFAULT_COMPLECTION_MODEL } from './constants';
import { CompletionRequestBean, InlayList, InlineCompletionItem } from './model/competionModel';
import { PromptCache } from './promptCache';
import { getPrefixPrompt, getSuffixPrompt } from './provider';
import { AICompletionsService } from './service/ai-completions.service';
import { ICompletionContext } from './types';

let timer: any;
let accept = 0;

// 用来缓存最近一次的补全结果
const lastInLayList: InlayList = {
  line: -1,
  column: -1,
  lastResult: null,
};

// 修改埋点代码数据
export const getAcceptText = (cuont: number) => {
  accept = accept + cuont;
};

class CompletionRequest {
  isCancelFlag: boolean;
  // todo
  constructor(
    public model: monaco.editor.ITextModel,
    public _isManual: boolean,
    public aiCompletionsService: AICompletionsService,
    public promptCache: PromptCache,
    public injector: Injector,
  ) {
    this.isCancelFlag = false;
  }
  // 发送请求
  async sendRequest(
    position: monaco.Position,
    aiReporter: IAIReporter,
    model: monaco.editor.ITextModel,
    token: monaco.CancellationToken,
  ) {
    const { model: editor } = this;
    if (!editor) {
      return [];
    }

    const startRange = new monaco.Range(0, 0, position.lineNumber, position.column);
    const prefix = model.getValueInRange(startRange);

    const endRange = new monaco.Range(
      position.lineNumber,
      position.column,
      model.getLineCount(),
      Number.MAX_SAFE_INTEGER,
    );
    let suffix = model.getValueInRange(endRange);

    const languageId = model.getLanguageId();
    const context: ICompletionContext = {
      filename: model.uri.toString().split('/').pop()!,
      language: languageId,
      prefix,
      suffix,
      prompt: '',
      uri: URI.from(model.uri),
    };

    const prompt = await getPrefixPrompt(context, DEFAULT_COMPLECTION_MODEL, this.injector, token);
    suffix = await getSuffixPrompt(context, DEFAULT_COMPLECTION_MODEL, this.injector, token);

    // 组装请求参数,向远程发起请求
    const completionRequestBean: CompletionRequestBean = {
      prompt,
      suffix,
      sessionId: uuid(6),
      language: languageId,
      fileUrl: model.uri.toString().split('/').pop()!,
    };

    this.aiCompletionsService.updateStatusBarItem('running', true);
    const beginAlgTime = Date.now();
    if (this.isCancelFlag) {
      return [];
    }
    let rs: IAICompletionResultModel | null;
    const cacheData = this.promptCache.getCache(prompt);

    const relationId = aiReporter.start(AISerivceType.Completion, { message: AISerivceType.Completion });
    this.aiCompletionsService.setLastRelationId(relationId);

    // 如果存在缓存
    if (cacheData) {
      rs = cacheData;
    } else {
      try {
        rs = await this.aiCompletionsService.complete(completionRequestBean, model, position, token);
      } catch (error) {
        this.aiCompletionsService.reporterEnd(relationId, {
          success: false,
          replytime: Date.now() - beginAlgTime,
          message: error.toString(),
        });
        this.aiCompletionsService.hideStatusBarItem();
        return [];
      }
    }

    if (!(rs && rs.sessionId)) {
      this.aiCompletionsService.reporterEnd(relationId, { success: false, replytime: Date.now() - beginAlgTime });
      this.aiCompletionsService.hideStatusBarItem();
      return [];
    }

    this.aiCompletionsService.setLastSessionId(rs.sessionId);

    // 如果是取消直接返回
    if ((rs && rs.isCancel) || this.isCancelFlag) {
      this.aiCompletionsService.reporterEnd(relationId, {
        success: true,
        replytime: Date.now() - beginAlgTime,
        isStop: true,
        completionNum: 0,
      });
      this.aiCompletionsService.updateStatusBarItem('canceled', false);
      return [];
    }

    if (rs && rs.codeModelList && rs.codeModelList.length > 0) {
      this.promptCache.setCache(prompt, rs);
    }
    // 返回补全结果为空直接返回
    if (rs.codeModelList.length === 0) {
      this.aiCompletionsService.reporterEnd(relationId, {
        success: true,
        replytime: Date.now() - beginAlgTime,
        completionNum: 0,
      });
      this.aiCompletionsService.updateStatusBarItem('no result', false);
      return [];
    }

    this.aiCompletionsService.updateStatusBarItem('completion result: ' + rs.codeModelList.length, false);
    return this.pushResultAndRegist(rs, position, relationId);
  }
  /**
   * 将补全结果推给用户并注册{@link COMMAND_ACCEPT} 事件
   * @param codeModelList
   */
  pushResultAndRegist(
    rs: IAICompletionResultModel,
    position: monaco.Position,
    relationId: string,
  ): Array<InlineCompletionItem> {
    const result = new Array<InlineCompletionItem>();
    for (const codeModel of rs.codeModelList) {
      const contentText = codeModel.content;

      let str = contentText;
      while (true) {
        if (!str.endsWith('\n')) {
          break;
        }
        str = str.slice(0, -1);
      }

      const insertText = str;
      const model = this.model;

      const textAfterCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: model.getLineMaxColumn(position.lineNumber),
      });

      // 临时修复方案，用于解决补全后面多了几个括号的问题
      const removeChars = (a: string, b: string) => {
        let result = '';
        for (const char of b) {
          if (char === ' ' || !a.includes(char)) {
            result += char;
          }
        }
        return result;
      };

      const filteredString = removeChars(insertText, textAfterCursor);

      result.push({
        insertText: insertText + filteredString,
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column + insertText.length + textAfterCursor.length,
        ),
        sessionId: rs.sessionId,
        command: {
          id: AI_INLINE_COMPLETION_REPORTER.id,
          title: '',
          arguments: [relationId, rs.sessionId, true],
        },
      });
    }
    return result;
  }
  cancelRequest() {
    this.isCancelFlag = true;
  }
}

class ReqStack {
  queue: any[];
  constructor(private readonly aiReporter) {
    this.queue = [];
  }
  addReq(reqRequest: CompletionRequest) {
    this.queue.push(reqRequest);
  }
  runReq(position: monaco.Position, model: monaco.editor.ITextModel, token: monaco.CancellationToken) {
    if (this.queue.length === 0) {
      return;
    }
    const fn = this.queue.pop();
    return fn.sendRequest(position, this.aiReporter, model, token);
  }
  cancleRqe() {
    if (this.queue.length === 0) {
      return;
    }
    this.queue.forEach((item) => {
      item.cancelRequest();
    });
    this.queue = [];
  }
}

@Injectable({ multiple: false })
export class AIInlineCompletionsProvider extends WithEventBus {
  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IAIReporter)
  private aiReporter: IAIReporter;

  @Autowired()
  private promptCache: PromptCache;

  private aiNativeContextKey: AINativeContextKey;

  isManual: boolean;
  isDelEvent: boolean;
  reqStack: ReqStack;

  public registerEditor(editor: IEditor): void {
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [(editor.monacoEditor as any)._contextKeyService]);

    this.isManual = false;
    this.isDelEvent = false;
    this.reqStack = new ReqStack(this.aiReporter);
  }

  cancelRequest() {
    this.aiCompletionsService.cancelRequest();
    if (this.reqStack) {
      this.reqStack.cancleRqe();
    }
    if (timer) {
      clearTimeout(timer);
    }
  }

  resetContextKey() {
    this.aiNativeContextKey.inlineCompletionIsTrigger.reset();
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
    this.aiNativeContextKey.inlineCompletionIsTrigger.set(true);
    // bugfix:修复当鼠标移动到代码补全上会触发一次手势事件，增加防抖，当手势触发后，能够防抖一次
    if (context.triggerKind === 0) {
      if (
        lastInLayList.column === position.column &&
        lastInLayList.line === position.lineNumber &&
        lastInLayList.lastResult !== undefined
      ) {
        lastInLayList.column = -1;
        lastInLayList.line = -1;
        return lastInLayList.lastResult;
      }
    }
    this.cancelRequest();
    this.aiCompletionsService.hideStatusBarItem();

    // step 1 判断生成开关,如果关闭不进行后续操作
    const _isManual = this.isManual;
    if (this.isDelEvent && !_isManual) {
      return {
        items: [],
      };
    }
    // 重置防止不触发自动补全事件
    this.udateIsManualVal(false);
    // 如果用户已取消
    if (token?.isCancellationRequested) {
      this.aiCompletionsService.updateStatusBarItem('completion not avaliable ', false);
      return {
        items: [],
      };
    }
    // 放入队列
    const requestImp = new CompletionRequest(
      model,
      _isManual,
      this.aiCompletionsService,
      this.promptCache,
      this.injector,
    );
    this.reqStack.addReq(requestImp);
    // 如果是自动补全等待300ms
    if (!_isManual) {
      await new Promise((f) => {
        timer = setTimeout(f, 300);
      });
    }
    const list = await this.reqStack.runReq(position, model, token);
    if (position !== undefined) {
      lastInLayList.column = position.column;
      lastInLayList.line = position.lineNumber;
    }

    lastInLayList.lastResult = {
      items: list || [],
    };
    return {
      items: list || [],
    };
  }
  /**
   * 更新isManual的值，判断是否是主动补全
   */
  udateIsManualVal(val: boolean) {
    this.isManual = val;
  }
}
