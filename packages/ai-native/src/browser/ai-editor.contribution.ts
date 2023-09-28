import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next';
import {
  IDisposable,
  URI,
  MaybePromise,
  Disposable,
  Event,
  uuid,
  CommandService,
  ILoggerManagerClient,
  SupportLogNamespace,
  ILogServiceClient,
} from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { DocumentSymbolStore } from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { IFileTreeAPI } from '@opensumi/ide-file-tree-next';
import { Position } from '@opensumi/ide-monaco';
import { editor as MonacoEditor } from '@opensumi/monaco-editor-core';
import { InlineCompletion, InlineCompletions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { AiGPTBackSerivcePath, InstructionEnum } from '../common/index';

import { AiChatService } from './ai-chat.service';
import { AiCodeWidget } from './code-widget/ai-code-widget';
import { AiContentWidget } from './content-widget/ai-content-widget';
import { AiInlineChatService, EChatStatus } from './content-widget/ai-inline-chat.service';
import { AiDiffWidget } from './diff-widget/ai-diff-widget';
import { prePromptHandler, preSuffixHandler, ReqStack } from './inline-completions/provider';

@Injectable()
export class AiEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AiGPTBackSerivcePath)
  private readonly aiGPTBackService: any;

  @Autowired(AiInlineChatService)
  private readonly aiInlineChatService: AiInlineChatService;

  @Autowired(DocumentSymbolStore)
  private documentSymbolStore: DocumentSymbolStore;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(AiChatService)
  private readonly aiChatService: AiChatService;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  private logger: ILogServiceClient;

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  contribute(editor: IEditor): IDisposable {
    if (!editor) {
      return this;
    }

    this.registerSuggestJavaDoc(editor);
    this.registerCompletion(editor);

    const { monacoEditor, currentUri } = editor;
    if (currentUri && currentUri.codeUri.scheme !== 'file') {
      return this;
    }

    let aiDiffWidget: AiDiffWidget;
    let aiCodeWidget: AiCodeWidget;
    let aiContentWidget: AiContentWidget;
    const aiInlineChatDisposed = new Disposable();

    const disposeAllWidget = () => {
      if (aiDiffWidget) {
        aiDiffWidget.dispose();
      }
      if (aiCodeWidget) {
        aiCodeWidget.dispose();
      }
      if (aiContentWidget) {
        aiContentWidget.dispose();
      }
      if (aiInlineChatDisposed) {
        aiInlineChatDisposed.dispose();
      }
    };

    this.disposables.push(
      monacoEditor.onDidChangeModel(() => {
        disposeAllWidget();
      }),
    );

    Event.debounce(
      Event.any(monacoEditor.onDidChangeCursorSelection),
      (_, e) => e,
      100,
    )((e) => {
      disposeAllWidget();

      const { monacoEditor, currentUri } = editor;

      if (!currentUri) {
        return;
      }

      if (currentUri && currentUri.codeUri.scheme !== 'file') {
        return;
      }

      const selection = monacoEditor.getSelection();

      if (!selection) {
        disposeAllWidget();
        return;
      }

      const { startLineNumber, endLineNumber } = selection;
      // 获取指定范围内的文本内容
      const text = monacoEditor.getModel()?.getValueInRange(selection);

      if (!text?.trim()) {
        return;
      }

      this.logger.log('monacoEditor.onMouseUp: >>> text', text);

      this.aiInlineChatService.launchChatMessage(EChatStatus.READY);

      aiContentWidget = this.injector.get(AiContentWidget, [monacoEditor]);

      aiContentWidget.show({
        selection,
      });

      aiInlineChatDisposed.addDispose(
        aiContentWidget.onSelectChange(async (value) => {
          if (aiDiffWidget) {
            aiDiffWidget.dispose();
          }

          const model = monacoEditor.getModel();
          if (!model) {
            return;
          }

          if (value === '解释代码') {
            this.aiChatService.launchChatMessage({
              message: InstructionEnum.aiExplainKey,
              prompt: this.aiChatService.explainCodePrompt(),
            });
            return;
          }

          if (value === '生成测试用例') {
            this.aiInlineChatService.launchChatMessage(EChatStatus.THINKING);

            // @ts-ignore
            const symbols = this.documentSymbolStore.getDocumentSymbol(model.uri!);

            const findRange = (range: { startLineNumber: number; endLineNumber: number }) => {
              if (!symbols) {
                return;
              }

              return symbols
                .map((obj) =>
                  // (range.startLineNumber >= obj.range.startLineNumber && range.endLineNumber <= obj.range.endLineNumber ? obj : null)
                  (obj.children || []).find(
                    (child) =>
                      range.startLineNumber >= child.range.startLineNumber &&
                      range.endLineNumber <= child.range.endLineNumber,
                  ),
                )
                .filter(Boolean)[0];
            };

            const fullCode = monacoEditor.getValue();

            const currentFunc = findRange(selection);

            if (!currentFunc) {
              return;
            }

            aiCodeWidget = this.injector.get(AiCodeWidget, [monacoEditor!]);
            aiContentWidget.addDispose(aiCodeWidget);

            const prompt = `这是我的完整代码。\`\`\`${fullCode}\`\`\`。请帮我生成 ${currentFunc.name} 方法的单元测试用例，不需要解释，只需要返回代码结果`;

            this.logger.log('生成测试用例 prompt:>>> ', prompt);
            const result = await this.aiGPTBackService.aiGPTcompletionRequest(prompt);

            if (aiContentWidget.disposed) {
              return;
            }

            // 说明接口有异常
            if (result.errorCode !== 0) {
              this.aiInlineChatService.launchChatMessage(EChatStatus.ERROR);
            } else {
              this.aiInlineChatService.launchChatMessage(EChatStatus.DONE);
            }

            let answer = result && result.data;

            // 提取代码内容
            const regex = /```\w*\s*([\s\S]+?)\s*```/;
            const regExec = regex.exec(answer);
            answer = (regExec && regExec[1]) || answer;

            this.logger.log('生成测试用例 answer:>>> ', result);

            if (answer) {
              // 文件后缀名
              const ext = URI.from(model.uri).path.ext;
              const testUri = model.uri.with({
                path: model.uri.path.replace(ext, `.test${ext}`),
              });

              this.logger.log(testUri);

              aiCodeWidget.setAnswerValue(answer);
              aiCodeWidget.setHeadUri(testUri.toString());
              aiCodeWidget.create();
              aiCodeWidget.showByLine(endLineNumber, selection.endLineNumber - selection.startLineNumber + 2);

              // 调整 aiContentWidget 位置
              aiContentWidget?.setOptions({
                position: {
                  lineNumber: endLineNumber + 1,
                  column: selection.startColumn,
                },
              });
              aiContentWidget?.layoutContentWidget();

              aiInlineChatDisposed.addDispose(
                this.aiInlineChatService.onAccept(async (value) => {
                  // 采纳后在同级目录下新建测试文件
                  if (testUri) {
                    await this.fileTreeAPI.createFile(URI.parse(testUri.path), answer);
                  }

                  setTimeout(() => {
                    disposeAllWidget();
                  }, 110);
                }),
              );

              aiInlineChatDisposed.addDispose(
                this.aiInlineChatService.onDiscard((value) => {
                  setTimeout(() => {
                    disposeAllWidget();
                  }, 110);
                }),
              );
            }

            return;
          }

          if (value) {
            const prompt = `这是我的完整代码：\`\`\`${text}\`\`\`。我会问你一些问题，你需要根据我给的代码回答我的问题，不需要解释，只需要返回代码结果，并保留代码的缩进。我的问题是: ${value}`;
            this.aiInlineChatService.launchChatMessage(EChatStatus.THINKING);

            this.logger.log('输入框 prompt:>>> ', prompt);

            const result = await this.aiGPTBackService.aiGPTcompletionRequest(prompt);

            if (aiInlineChatDisposed.disposed) {
              return;
            }

            // 说明接口有异常
            if (result.errorCode !== 0) {
              this.aiInlineChatService.launchChatMessage(EChatStatus.ERROR);
            } else {
              this.aiInlineChatService.launchChatMessage(EChatStatus.DONE);
            }

            this.logger.log('aiGPTcompletionRequest:>>> ', result);

            let answer = result && result.data;

            // 提取代码内容
            const regex = /```\w*\s*([\s\S]+?)\s*```/;
            const regExec = regex.exec(answer);
            answer = (regExec && regExec[1]) || answer;

            this.logger.log('aiGPTcompletionRequest:>>> refresh answer', answer);
            if (answer) {
              // 控制缩进
              const indents = ' '.repeat(4);
              const spcode = answer.split('\n');
              answer = spcode.map((s, i) => (i === 0 ? s : indents + s)).join('\n');

              aiDiffWidget = this.injector.get(AiDiffWidget, [monacoEditor!, text, answer]);
              aiDiffWidget.create();
              aiDiffWidget.showByLine(endLineNumber, selection.endLineNumber - selection.startLineNumber + 2);

              // 调整 aiContentWidget 位置
              aiContentWidget?.setOptions({
                position: {
                  lineNumber: endLineNumber + 1,
                  column: selection.startColumn,
                },
              });
              aiContentWidget?.layoutContentWidget();

              aiInlineChatDisposed.addDispose(
                this.aiInlineChatService.onAccept((value) => {
                  // monacoEditor.getModel()?.pushStackElement();
                  monacoEditor.getModel()?.pushEditOperations(
                    null,
                    [
                      {
                        range: selection,
                        text: answer,
                      },
                    ],
                    () => null,
                  );
                  // monacoEditor.getModel()?.pushStackElement();

                  setTimeout(() => {
                    disposeAllWidget();
                  }, 110);
                }),
              );

              aiInlineChatDisposed.addDispose(
                this.aiInlineChatService.onDiscard((value) => {
                  setTimeout(() => {
                    disposeAllWidget();
                  }, 110);
                }),
              );
            }
          }
        }),
      );
    });

    this.logger.log('AiEditorContribution:>>>', editor, monacoEditor);

    return this;
  }
  provideEditorOptionsForUri?(uri: URI): MaybePromise<Partial<MonacoEditor.IEditorOptions>> {
    throw new Error('Method not implemented.');
  }

  /**
   * java doc
   */
  private async registerSuggestJavaDoc(editor: IEditor): Promise<void> {
    const { monacoEditor, currentUri, currentDocumentModel } = editor;

    if (currentUri && currentUri.codeUri.scheme !== 'file') {
      return;
    }

    let inlayHintDispose: IDisposable | undefined;

    this.disposables.push(
      monacoEditor.onDidChangeModelContent((event) => {
        const model = monacoEditor.getModel();
        if (!model) {
          return;
        }

        if (inlayHintDispose) {
          inlayHintDispose.dispose();
        }

        const content = model.getValue();

        // 使用正则表达式匹配所有 "/**" 的位置
        const matches = content.matchAll(/\/\*\*/g);

        // 存在 /** 的 position 集合
        const hasKeyPosition: Position[] = [];

        // 遍历匹配结果并输出位置信息
        for (const match of matches) {
          // const startPosition = model.getPositionAt(match.index!);
          const endPosition = model.getPositionAt(match.index! + match[0].length);
          hasKeyPosition.push(endPosition);
        }

        // @ts-ignore
        const symbols = this.documentSymbolStore.getDocumentSymbol(model.uri!);

        this.logger.log('documentSymbolStore: symbols>>> ', symbols);
        const findRange = (range: Position) => {
          if (!symbols) {
            return { range: null };
          }
          return symbols
            .map(
              (obj) =>
                (obj.range.startLineNumber === range.lineNumber ? obj : null) ||
                (obj.children || []).find((child) => child.range.startLineNumber === range.lineNumber),
            )
            .filter(Boolean)[0];
        };

        if (hasKeyPosition.length > 0) {
          // inlayHintDispose = monaco.languages.registerInlayHintsProvider(model.getLanguageId(), {
          inlayHintDispose = monaco.languages.registerInlayHintsProvider(
            {
              language: model.getLanguageId(),
              scheme: 'file',
            },
            {
              provideInlayHints(model, range, token) {
                return {
                  hints: hasKeyPosition.map((position) => ({
                    kind: monaco.languages.InlayHintKind.Parameter,
                    position: { column: position.column, lineNumber: position.lineNumber },
                    label: [
                      {
                        label: '✨ Suggest documentation',
                        command: {
                          id: 'ai.suggest.documentation',
                          title: '',
                          arguments: [findRange(position)?.range],
                        },
                      },
                    ],
                    paddingLeft: true,
                  })),
                  dispose: () => {},
                };
              },
            },
          );

          this.disposables.push(inlayHintDispose);
        }
      }),
    );
  }

  /**
   * 代码补全
   */
  private async registerCompletion(editor: IEditor): Promise<void> {
    const { monacoEditor, currentUri, currentDocumentModel } = editor;

    if (currentUri && currentUri.codeUri.scheme !== 'file') {
      return;
    }

    let dispose: IDisposable | undefined;

    const cancelRequest = () => {
      if (reqStack) {
        reqStack.cancleRqe();
      }
      if (timer) {
        clearTimeout(timer);
      }
    };

    this.disposables.push(
      monacoEditor.onDidChangeModel(() => {
        if (dispose) {
          dispose.dispose();
        }
      }),
    );

    const reqStack = new ReqStack();
    let timer: any;

    let isCancelFlag = false;

    this.disposables.push(
      Event.debounce(
        monacoEditor.onDidChangeModelContent,
        (_, e) => e,
        300,
      )(async (event) => {
        if (dispose) {
          dispose.dispose();
        }

        const model = monacoEditor.getModel();
        if (!model) {
          return;
        }

        // 取光标的当前位置
        const position = monacoEditor.getPosition();
        if (!position) {
          return;
        }

        cancelRequest();
        dispose = monaco.languages.registerInlineCompletionsProvider(model.getLanguageId(), {
          provideInlineCompletions: async (model, position, context, token) => {
            // 补全上文
            const startRange = new monaco.Range(0, 0, position.lineNumber, position.column);
            let prompt = model.getValueInRange(startRange);

            // 补全下文
            const endRange = new monaco.Range(
              position.lineNumber,
              position.column,
              model.getLineCount(),
              Number.MAX_SAFE_INTEGER,
            );
            let suffix = model.getValueInRange(endRange);

            prompt = prePromptHandler(prompt);
            suffix = preSuffixHandler(suffix);

            const uid = uuid();

            const language = model.getLanguageId();

            reqStack.addReq({
              sendRequest: async () => {
                isCancelFlag = false;
                const completionResult = await this.aiGPTBackService.aiCompletionRequest({
                  prompt,
                  suffix,
                  sessionId: uid,
                  language,
                  fileUrl: model.uri.toString().split('/').pop(),
                });

                const items = completionResult.data.codeModelList;
                this.logger.log('onDidChangeModelContent:>>> ai 补全返回结果', completionResult);
                return {
                  items: items.map((data) => ({
                    insertText: data.content,
                  })),
                };
              },
              cancelRequest: () => {
                isCancelFlag = true;
              },
            });

            await new Promise((f) => {
              timer = setTimeout(f, 300);
            });

            this.logger.log('onDidChangeModelContent:>>> 参数', {
              prompt,
              suffix,
              uid,
              language,
            });

            return reqStack.runReq() || [];
          },
          freeInlineCompletions(completions: InlineCompletions<InlineCompletion>) {},
        });
        this.disposables.push(dispose);
      }),
    );
  }
}
