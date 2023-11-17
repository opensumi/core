import { debounce } from 'lodash';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Disposable, WithEventBus, uuid } from '@opensumi/ide-core-common';
import { ICodeEditor, IEditor } from '@opensumi/ide-editor';
import { EditorSelectionChangeEvent } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { CompletionRequestBean, CompletionResultModel, CodeModel, InlayList } from './model/competionModel';
import { InlineCompletionItem } from './model/competionModel';
import promptCache from './promptCache';
import { prePromptHandler, preSuffixHandler } from './provider';
import { AiCompletionsService } from './service/ai-completions.service';
import { MESSAGE_SHOW_TIME, getPromptMessageText, getMoreStr } from './utils/message';


let lastRequestId: any;
let timer: any;
let accept = 0;

// 用来缓存最近一次的补全结果
let lastInLayList: InlayList = {
  line: -1,
  column: -1,
  lastResult: null,
};

// 修改埋点代码数据
export const getAcceptText = (cuont: number) => {
  accept = accept + cuont;
};

class RequestImp {
  editor: IEditor;
  _isManual: boolean;
  isCancelFlag: boolean;
  // todo
  constructor(editor: IEditor, _isManual: boolean) {
    this.editor = editor;
    this._isManual = _isManual;
    this.isCancelFlag = false;
  }
  // 发送请求
  async sendRequest(codefuseService: AiCompletionsService) {
    const { editor } = this;
    let beginRequestTime = Date.now();
    if (!editor) {
      return [];
    }

    const model = this.editor.monacoEditor.getModel()!;
    let selection = this.editor.monacoEditor.getSelection();
    const cursorPosition = selection?.getPosition()!;

    const startRange = selection?.setStartPosition(0, 0);
    let prompt = model.getValueInRange(startRange!);

    // 如果是空白页面,默认加个回车符?
    if (this.editor.monacoEditor.getValue() === '') {
      prompt += '\n';
    }

    const endRange = new monaco.Range(
      cursorPosition.lineNumber,
      cursorPosition.column,
      model.getLineCount(),
      Number.MAX_SAFE_INTEGER,
    );
    let suffix = model.getValueInRange(endRange);

    // 改用analysisCodeFuseLanguage  现在目前后端需要语言小写
    const languageId = model.getLanguageId();
    // if (completionRtModel !== undefined && completionRtModel.sessionId === null) {
    //     //此处未采纳上一个补全结果,那么设置endtime,并提交到服务端
    //     completionRtModel.endRenderingTime = Date.now();
    //     submitCompleteRtData(completionRtModel);
    // }
    // TODO 缺少数据前处理
    // prompt = prePromptHandler(prompt);
    // suffix = preSuffixHandler(suffix);

    prompt = prePromptHandler(prompt);
    suffix = preSuffixHandler(suffix);

    // 组装请求参数,向远程发起请求
    let completionRequestBean: CompletionRequestBean = {
      prompt,
      suffix,
      sessionId: uuid(6),
      language: languageId,
      fileUrl: model.uri.toString().split('/').pop()!,
    };

    let beginAlgTime = new Date().getTime();
    let status = 0; // 0: 远程请求的结果 1: 网络缓存中的结果
    if (this.isCancelFlag) {
      return [];
    }
    let rs;
    const cacheData = promptCache.getCache(prompt);

    // 如果存在缓存
    if (cacheData) {
      rs = cacheData;
      status = 1;
    } else {
      // 不存在缓存发起请求
      try {
        rs = await codefuseService.complete(completionRequestBean);
        status = 0;
      } catch (err: any) {
        return { items: [] };
      }
    }
    if (rs === null || rs.sessionId === null) {
      return { items: [] };
    }
    if (rs && rs.codeModelList !== null && rs.codeModelList.length > 0) {
      promptCache.setCache(prompt, rs);
    }
    let codeModelSize = 0;
    if (rs.codeModelList !== null) {
      codeModelSize = rs.codeModelList.length;
    }
    // 返回补全结果为空直接返回
    if (rs.codeModelList.length === 0) {
      return [];
    }
    // 如果是取消直接返回
    if (this.isCancelFlag) {
      return [];
    }
    return this.pushResultAndRegist(rs, cursorPosition);
  }
  /**
   * 将补全结果推给用户并注册{@link COMMAND_ACCEPT} 事件
   * @param codeModelList
   */
  pushResultAndRegist(rs: CompletionResultModel, cursorPosition: monaco.Position): Array<InlineCompletionItem> {
    let result = new Array<InlineCompletionItem>();
    for (const codeModel of rs.codeModelList) {
      let contentText = codeModel.content;

      while (true) {
        if (!contentText.endsWith('\n') || contentText.length < 1) {break;}
        contentText = contentText.slice(0, -1);
      }

      const list = contentText.split('\n');

      const lastLine = list[list.length - 1];
      const spaceL = lastLine.length - lastLine.replace(/[ ]/g, '').length;
      const note = getPromptMessageText();

      const arr = contentText.split(contentText[contentText.length - 1]);
      if (arr[arr.length - 1].length === 0) {
        contentText = contentText.slice(0, -1);
      }
      let insertText = contentText;

      // if (MESSAGE_SHOW_TIME < 2) {
      //   insertText = codeModel.completionType === 1 && list.length > 1 ? `${insertText}\n\n${getMoreStr(spaceL, ' ')}${note}` : `${insertText}${getMoreStr(10, ' ')}${note}`.replace(/[\r|\n]/g, '')
      // }

      result.push({
        insertText,
        // range: new monaco.Range(
        //   cursorPosition.translate(0, insertText.length),
        //   cursorPosition
        // ),
        sessionId: rs.sessionId,
      });
    }
    lastRequestId = rs.sessionId;
    // if (rs.codeModelList.length) setPromptMessage(completionType, content)
    return result;
  }
  cancelRequest() {
    this.isCancelFlag = true;
  }
}

class ReqStack {
  queue: any[];
  constructor(private readonly aiCompletionsService) {
    this.queue = [];
  }
  addReq(reqRequest: RequestImp) {
    this.queue.push(reqRequest);
  }
  runReq() {
    if (this.queue.length === 0) {
      return;
    }
    const fn = this.queue.pop();
    return fn.sendRequest(this.aiCompletionsService);
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
/**
 * 代码补全provider
 * @param extensionContext
 * @param this.tyStatusBarItem
 * @returns
 */

interface ProviderType extends monaco.languages.InlineCompletionsProvider {
  isManual: boolean;
}

@Injectable({ multiple: true })
export class TypeScriptCompletionsProvider extends WithEventBus implements ProviderType {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AiCompletionsService)
  private aiCompletionsService: AiCompletionsService;

  isManual: boolean;
  isDelEvent: boolean;
  reqStack: ReqStack;

  constructor(private readonly editor: IEditor) {
    super();

    this.isManual = false;
    this.isDelEvent = false;
    this.reqStack = new ReqStack(this.aiCompletionsService);

    const { monacoEditor } = editor;

    // 判断用户是否选择了一块区域或者移动光标 取消掉请补全求
    const selectionChange = () => {
      // clearPromptMessage()
      const editor = this.editor;
      if (!editor) {
        return;
      }
      // clearPromptMessage();
      const selection = editor.monacoEditor.getSelection()!;
      // 判断是否选中区域
      if (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn) {
        this.cancelRequest();
      }
    };

    const debouncedSelectionChange = debounce(() => selectionChange(), 50, {
      maxWait: 200,
      leading: true,
      trailing: true,
    });

    this.addDispose(
      this.eventBus.on(EditorSelectionChangeEvent, (e) => {
        if (e.payload.source === 'mouse') {
          debouncedSelectionChange();
        } else {
          debouncedSelectionChange.cancel();
          selectionChange();
        }
      }),
    );
  }
  provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken,
  ): monaco.languages.ProviderResult<monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>> {
    throw new Error('Method not implemented.');
  }
  handleItemDidShow?(
    completions: monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>,
    item: monaco.languages.InlineCompletion,
  ): void {
    throw new Error('Method not implemented.');
  }
  freeInlineCompletions(completions: monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>): void {
    throw new Error('Method not implemented.');
  }

  // 取消请求
  cancelRequest() {
    // if (this.aiCompletionsService.getCancelSignal()) {
    //   this.aiCompletionsService.cancelRequest();
    // }
    if (this.reqStack) {
      this.reqStack.cancleRqe();
    }
    if (timer) {
      clearTimeout(timer);
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

    // step 1 判断生成开关,如果关闭不进行后续操作
    const _isManual = this.isManual;
    if (this.isDelEvent && !_isManual) {
      return [];
    }
    // 重置防止不触发自动补全事件
    this.udateIsManualVal(false);
    // 如果用户已取消
    if (token?.isCancellationRequested) {
      return;
    }
    // 放入队列
    const requestImp = new RequestImp(this.editor, _isManual);
    this.reqStack.addReq(requestImp);
    // 如果是自动补全等待300ms
    if (!_isManual) {
      await new Promise((f) => {
        timer = setTimeout(f, 300);
      });
    }
    const list = await this.reqStack.runReq();
    if (position !== undefined) {
      lastInLayList.column = position.column;
      lastInLayList.line = position.lineNumber;
    }
    lastInLayList.lastResult = list || [];
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
