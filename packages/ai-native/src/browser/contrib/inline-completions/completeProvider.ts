import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AppConfig, PreferenceService } from '@opensumi/ide-core-browser';
import { AI_INLINE_COMPLETION_REPORTER } from '@opensumi/ide-core-browser/lib/ai-native/command';
import {
  AINativeSettingSectionsId,
  DisposableStore,
  URI,
  WithEventBus,
  raceCancellation,
  sleep,
  uuid,
} from '@opensumi/ide-core-common';
import { IAICompletionOption, IAICompletionResultModel } from '@opensumi/ide-core-common/lib/types/ai-native';
import { AISerivceType, IAIReporter } from '@opensumi/ide-core-common/lib/types/ai-native/reporter';
import { IEditor } from '@opensumi/ide-editor';
import * as monaco from '@opensumi/ide-monaco';

import { DEFAULT_COMPLECTION_MODEL } from './constants';
import { IInlineCompletionCache, InlineCompletionItem } from './model/competionModel';
import { PromptCache } from './promptCache';
import { getPrefixPrompt, getSuffixPrompt, lineBasedPromptProcessor } from './provider';
import { AICompletionsService } from './service/ai-completions.service';
import { ICompletionContext } from './types';

// 用来缓存最近一次的补全结果
const inlineCompletionCache: IInlineCompletionCache = {
  line: -1,
  column: -1,
  last: null,
};

const makeHashSet = (str: string) => {
  const set = new Set<string>();
  for (const char of str) {
    set.add(char);
  }
  return set;
};

const removeChars = (insertText: string, textAfterCursor: string) => {
  let result = '';
  const aSet = makeHashSet(insertText);
  for (const char of textAfterCursor) {
    // 如果是空格或者 insertText 中不存在的字符，就加入到结果中
    if (char === ' ' || !aSet.has(char)) {
      result += char;
    }
  }
  return result;
};

@Injectable({ multiple: true })
export class CompletionRequestTask {
  private _disposables = new DisposableStore();

  @Autowired(IAIReporter)
  private aiReporter: IAIReporter;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(PromptCache)
  private promptCache: PromptCache;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  isCancelFlag: boolean;

  private isEnablePromptEngineering = true;

  constructor(
    public model: monaco.editor.ITextModel,
    public position: monaco.Position,
    public token: monaco.CancellationToken,
    public _isManual: boolean,
  ) {
    this.isCancelFlag = false;

    this.isEnablePromptEngineering = this.preferenceService.getValid(
      AINativeSettingSectionsId.InlineCompletionsPromptEngineeringEnabled,
      this.isEnablePromptEngineering,
    );

    this._disposables.add(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.InlineCompletionsPromptEngineeringEnabled,
        ({ newValue }) => {
          this.isEnablePromptEngineering = newValue;
        },
      ),
    );
  }

  async constructRequestBean(
    context: ICompletionContext,
    token: monaco.CancellationToken,
  ): Promise<IAICompletionOption> {
    if (this.isEnablePromptEngineering) {
      const prompt = await getPrefixPrompt(context, DEFAULT_COMPLECTION_MODEL, this.injector, token);
      const suffix = await getSuffixPrompt(context, DEFAULT_COMPLECTION_MODEL, this.injector, token);

      return {
        prompt,
        suffix,
        sessionId: uuid(),
        language: context.language,
        fileUrl: context.fileUrl,
        workspaceDir: context.workspaceDir,
      };
    }

    const prompt = lineBasedPromptProcessor.processPrefix(context.prefix);
    const suffix = lineBasedPromptProcessor.processSuffix(context.suffix);
    return {
      prompt,
      suffix,
      sessionId: uuid(),
      language: context.language,
      fileUrl: context.fileUrl,
      workspaceDir: context.workspaceDir,
    };
  }

  // 发送请求
  async run() {
    const { model, position, token } = this;
    if (!model) {
      return [];
    }
    if (token.isCancellationRequested) {
      return [];
    }

    if (this.isCancelFlag) {
      return [];
    }

    const startRange = new monaco.Range(0, 0, position.lineNumber, position.column);
    let prefix = model.getValueInRange(startRange);
    if (prefix === '') {
      prefix += '\n';
    }

    const endRange = new monaco.Range(
      position.lineNumber,
      position.column,
      model.getLineCount(),
      Number.MAX_SAFE_INTEGER,
    );

    const suffix = model.getValueInRange(endRange);

    const languageId = model.getLanguageId();
    const context: ICompletionContext = {
      fileUrl: model.uri.fsPath,
      filename: model.uri.toString().split('/').pop()!,
      language: languageId,
      prefix,
      suffix,
      uri: URI.from(model.uri),
      workspaceDir: this.appConfig.workspaceDir,
    };

    // 组装请求参数,向远程发起请求
    const requestBean = await this.constructRequestBean(context, token);
    if (this.isCancelFlag) {
      return [];
    }

    this.aiCompletionsService.updateStatusBarItem('running', true);
    const requestStartTime = Date.now();

    let rs: IAICompletionResultModel | null;
    const cacheData = this.promptCache.getCache(requestBean);
    const relationId =
      cacheData?.relationId || this.aiReporter.start(AISerivceType.Completion, { message: AISerivceType.Completion });

    this.aiCompletionsService.setLastRelationId(relationId);
    // 如果存在缓存
    if (cacheData) {
      rs = cacheData;
    } else {
      try {
        rs = await this.aiCompletionsService.complete(requestBean, model, position, token);
      } catch (error) {
        this.aiCompletionsService.reporterEnd(relationId, {
          success: false,
          replytime: Date.now() - requestStartTime,
          message: error.toString(),
        });
        this.aiCompletionsService.hideStatusBarItem();
        return [];
      }
    }

    if (!(rs && rs.sessionId)) {
      this.aiCompletionsService.reporterEnd(relationId, { success: false, replytime: Date.now() - requestStartTime });
      this.aiCompletionsService.hideStatusBarItem();
      return [];
    }

    this.aiCompletionsService.setLastSessionId(rs.sessionId);

    // 如果是取消直接返回
    if ((rs && rs.isCancel) || token.isCancellationRequested || this.isCancelFlag) {
      this.aiCompletionsService.reporterEnd(relationId, {
        success: true,
        replytime: Date.now() - requestStartTime,
        isStop: true,
        completionNum: 0,
      });
      this.aiCompletionsService.updateStatusBarItem('canceled', false);
      return [];
    }

    // 返回补全结果为空直接返回
    if (!rs || !rs.codeModelList || rs.codeModelList.length === 0) {
      this.aiCompletionsService.reporterEnd(relationId, {
        success: true,
        replytime: Date.now() - requestStartTime,
        completionNum: 0,
      });
      this.aiCompletionsService.updateStatusBarItem('no result', false);
      return [];
    }

    if (rs.codeModelList.length > 0) {
      this.promptCache.setCache(requestBean, { ...rs, relationId });
    }

    this.aiCompletionsService.updateStatusBarItem('completion result: ' + rs.codeModelList.length, false);

    this.dispose();
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

      const insertText = contentText.trimEnd();

      const model = this.model;

      const textAfterCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: model.getLineMaxColumn(position.lineNumber),
      });

      // 临时修复方案，用于解决补全后面多了几个括号的问题
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
        relationId,
        command: {
          id: AI_INLINE_COMPLETION_REPORTER.id,
          title: '',
          arguments: [relationId, rs.sessionId, true],
        },
      });
    }
    return result;
  }

  dispose() {
    this._disposables.dispose();
  }

  cancelRequest() {
    this.isCancelFlag = true;
    this.dispose();
  }
}

class ReqStack {
  queue: CompletionRequestTask[];
  constructor() {
    this.queue = [];
  }
  addReq(reqRequest: CompletionRequestTask) {
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
export class AIInlineCompletionsProvider extends WithEventBus {
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
      AINativeSettingSectionsId.InlineCompletionsDebounceTime,
      150,
    );

    this.addDispose(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.InlineCompletionsDebounceTime,
        ({ newValue }) => {
          this.inlineComletionsDebounceTime = newValue;
        },
      ),
    );
  }

  public mountEditor(editor: IEditor): void {
    this.isManual = false;
    this.isDelEvent = false;
    this.reqStack = new ReqStack();
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
    this.aiCompletionsService.hideStatusBarItem();

    // step 1 判断生成开关,如果关闭不进行后续操作
    const _isManual = this.isManual;
    if (this.isDelEvent && !_isManual) {
      return undefined;
    }

    // 重置防止不触发自动补全事件
    this.updateIsManual(false);

    // 放入队列
    const requestImp = this.injector.get(CompletionRequestTask, [model, position, token, _isManual]);

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
