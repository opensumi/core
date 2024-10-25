import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, PreferenceService } from '@opensumi/ide-core-browser';
import { AI_INLINE_COMPLETION_REPORTER } from '@opensumi/ide-core-browser/lib/ai-native/command';
import {
  AINativeSettingSectionsId,
  Disposable,
  DisposableStore,
  IAICompletionOption,
  IAICompletionResultModel,
  IntelligentCompletionsRegistryToken,
  URI,
  uuid,
} from '@opensumi/ide-core-common';
import { AIServiceType, IAIReporter } from '@opensumi/ide-core-common/lib/types/ai-native/reporter';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import * as monaco from '@opensumi/ide-monaco';

import { IIntelligentCompletionsResult } from '../../intelligent-completions';
import { IntelligentCompletionsRegistry } from '../../intelligent-completions/intelligent-completions.feature.registry';
import { InlineCompletionsController } from '../inline-completions.controller';
import { InlineCompletionItem } from '../model/competionModel';
import { PromptCache } from '../promptCache';
import { lineBasedPromptProcessor } from '../provider';
import { AICompletionsService } from '../service/ai-completions.service';
import { ICompletionContext } from '../types';

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
export class InlineCompletionRequestTask extends Disposable {
  private _disposables = new DisposableStore();

  @Autowired(IAIReporter)
  private aiReporter: IAIReporter;

  @Autowired(PromptCache)
  private promptCache: PromptCache;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IntelligentCompletionsRegistryToken)
  private readonly intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorServiceImpl;

  isCancelFlag: boolean;

  private isEnablePromptEngineering = true;

  constructor(
    public model: monaco.editor.ITextModel,
    public position: monaco.Position,
    public token: monaco.CancellationToken,
  ) {
    super();

    this.isCancelFlag = false;

    this.isEnablePromptEngineering = this.preferenceService.getValid(
      AINativeSettingSectionsId.IntelligentCompletionsPromptEngineeringEnabled,
      this.isEnablePromptEngineering,
    );

    this._disposables.add(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.IntelligentCompletionsPromptEngineeringEnabled,
        ({ newValue }) => {
          this.isEnablePromptEngineering = newValue;
        },
      ),
    );
  }

  protected async constructRequestBean(
    context: ICompletionContext,
    token: monaco.CancellationToken,
  ): Promise<IAICompletionOption> {
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

    const requestStartTime = Date.now();

    let completeResult: IIntelligentCompletionsResult | undefined;
    const cacheData = this.promptCache.getCache(requestBean);
    const relationId =
      cacheData?.relationId || this.aiReporter.start(AIServiceType.Completion, { message: AIServiceType.Completion });

    this.aiCompletionsService.setLastRelationId(relationId);
    // 如果存在缓存
    if (cacheData) {
      completeResult = cacheData;
    } else {
      try {
        this.aiCompletionsService.updateStatusBarItem('running', true);
        const provider = this.intelligentCompletionsRegistry.getInlineCompletionsProvider();
        if (provider) {
          const editor = this.workbenchEditorService.currentCodeEditor;
          if (!editor) {
            return [];
          }
          const inlineCompletionsHandler = InlineCompletionsController.get(editor.monacoEditor);
          completeResult = await inlineCompletionsHandler?.fetchProvider(requestBean);
        } else {
          completeResult = await this.aiCompletionsService.complete(requestBean);
        }
      } catch (error) {
        this.aiCompletionsService.reporterEnd(relationId, {
          success: false,
          replytime: Date.now() - requestStartTime,
          message: error.toString(),
        });
        this.aiCompletionsService.hideStatusBarItem();
        return [];
      } finally {
        this.aiCompletionsService.hideStatusBarItem();
      }
    }

    if (!completeResult) {
      return [];
    }

    return this.pushLineCompletions(completeResult, requestBean, requestStartTime, relationId);
  }

  /**
   * 将补全结果推给用户并注册{@link COMMAND_ACCEPT} 事件
   */
  private pushLineCompletions(
    completeResult: IIntelligentCompletionsResult<IAICompletionResultModel> | undefined,
    requestBean: IAICompletionOption,
    requestStartTime: number,
    relationId: string,
  ): Array<InlineCompletionItem> {
    const { position } = this;

    this.aiCompletionsService.setLastSessionId(requestBean.sessionId);

    // 如果是取消直接返回
    if (completeResult?.extra?.isCancel || this.token.isCancellationRequested || this.isCancelFlag) {
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
    if (!completeResult || !completeResult.items || completeResult.items.length === 0) {
      this.aiCompletionsService.reporterEnd(relationId, {
        success: true,
        replytime: Date.now() - requestStartTime,
        completionNum: 0,
      });
      this.aiCompletionsService.updateStatusBarItem('no result', false);
      return [];
    }

    if (completeResult.items.length > 0) {
      this.promptCache.setCache(requestBean, { ...completeResult, relationId });
    }

    this.aiCompletionsService.updateStatusBarItem('completion result: ' + completeResult.items.length, false);

    this.dispose();

    const result = new Array<InlineCompletionItem>();
    for (const codeModel of completeResult.items) {
      const contentText = codeModel.insertText.toString();

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
      const insertContent = insertText + filteredString;

      this.aiCompletionsService.setLastCompletionContent(insertContent);

      result.push({
        ...codeModel,
        insertText: insertContent,
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column + insertText.length + textAfterCursor.length,
        ),
        sessionId: requestBean.sessionId,
        relationId,
        command: {
          id: AI_INLINE_COMPLETION_REPORTER.id,
          title: '',
          arguments: [relationId, requestBean.sessionId, true, insertContent],
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
