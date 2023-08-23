import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next';
import { IDisposable, URI, MaybePromise, Disposable, Event, IRange, uuid } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { DocumentSymbolStore } from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { Position } from '@opensumi/ide-monaco';
import { AiGPTBackSerivcePath } from '@opensumi/ide-startup/lib/common/index';
import { editor as MonacoEditor } from '@opensumi/monaco-editor-core';
import { InlineCompletion, InlineCompletions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { AiImproveWidget } from './ai-improve-widget';
import { AiZoneWidget } from './ai-zone-widget';
import { AiContentWidget } from './content-widget/ai-content-widget';
import { AiDiffWidget } from './diff-widget/ai-diff-widget';

@Injectable()
export class AiEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AbstractMenuService)
  private readonly abstractMenuService: AbstractMenuService;

  @Autowired(AiGPTBackSerivcePath)
  private readonly aiGPTBackService: any;

  @Autowired(DocumentSymbolStore)
  private documentSymbolStore: DocumentSymbolStore;

  public menuse: any;

  contribute(editor: IEditor): IDisposable {
    if (!editor) {
      return this;
    }

    this.registerSuggestJavaDoc(editor);
    this.registerCompletion(editor);

    const { monacoEditor, currentUri, currentDocumentModel } = editor;
    if (currentUri && currentUri.codeUri.scheme !== 'file') {
      return this;
    }

    // @ts-ignore
    window.aiGPTcompletionRequest = this.aiGPTBackService.aiGPTcompletionRequest;
    // @ts-ignore
    window.aiParsingLanguageService = this.aiGPTBackService.aiParsingLanguageService;

    let aiZoneWidget: AiZoneWidget | undefined;
    let aiDiffWidget: AiDiffWidget | undefined;
    let aiImproveWidget: AiImproveWidget | undefined;
    let aiContentWidget: AiContentWidget | undefined;

    const disposeAllWidget = () => {
      if (aiZoneWidget) {
        aiZoneWidget.dispose();
      }
      if (aiDiffWidget) {
        aiDiffWidget.dispose();
      }
      if (aiImproveWidget) {
        aiImproveWidget.dispose();
      }
      if (aiContentWidget) {
        aiContentWidget.dispose();
      }
    }

    this.disposables.push(monacoEditor.onDidChangeModel(() => {
      disposeAllWidget()
    }));

    // this.disposables.push(monacoEditor.onDidFocusEditorText(() => {
    //   disposeAllWidget()
    // }));

    Event.debounce(
      Event.any(
        monacoEditor.onDidChangeCursorSelection,
        // @ts-ignore
        // monacoEditor.onMouseUp
      ),
      (_, e) => e,
      100,
    )((e) => {
      disposeAllWidget();

      if (!this.menuse) {
        this.menuse = this.abstractMenuService.createMenu('ai/iconMenubar/context');
      }

      const selection = monacoEditor.getSelection();

      if (!selection) {
        disposeAllWidget();
        return;
      }

      const { startLineNumber, endLineNumber } = selection;
      // 获取指定范围内的文本内容
      const text = monacoEditor.getModel()?.getValueInRange(selection);

      if (!text) {
        return;
      }

      disposeAllWidget()

      console.log('monacoEditor.onMouseUp: >>> text', text);

      aiContentWidget = this.injector.get(AiContentWidget, [monacoEditor]);

      aiContentWidget.show({
        selection: selection
      })

      // aiZoneWidget = this.injector.get(AiZoneWidget, [monacoEditor!, this.menuse]);
      // aiZoneWidget.create();

      // // aiZoneWidget.showByLine(startLineNumber - 1);
      // aiZoneWidget.showByLine(endLineNumber);

      this.disposables.push(aiContentWidget.onSelectChange(async (value) => {

        if (aiDiffWidget) {
          aiDiffWidget.dispose();
        }

        // gpt 模型测试
        if (value) {
          const result = await this.aiGPTBackService.aiGPTcompletionRequest(`${value}, 要求只回答代码内容，并去掉 markdown 格式。不需要给我解释，代码内容是: \n` + text);
          console.log('aiGPTcompletionRequest:>>> ', result)

          const answer = result && result.data;

          if (answer) {
            aiDiffWidget = this.injector.get(AiDiffWidget, [monacoEditor!, text, answer]);
            aiDiffWidget.create();
            aiDiffWidget.showByLine(endLineNumber, selection.endLineNumber - selection.startLineNumber + 2);

            aiZoneWidget?.dispose();

            // aiImproveWidget
            aiImproveWidget = this.injector.get(AiImproveWidget, [monacoEditor!]);
            aiImproveWidget.create();
            aiImproveWidget.showByLine(endLineNumber, 3);

            this.disposables.push(aiImproveWidget.onClick(value => {
              if (value === '采纳') {
                monacoEditor.getModel()?.pushEditOperations(null, [
                  {
                    forceMoveMarkers: false,
                    range: selection,
                    text: answer,
                  }
                ], () => null);

                setTimeout(() => {
                  disposeAllWidget()
                }, 110)
              }
            }));
          }
        }

        console.log('aiZoneWidget:>>>> value change', value);
      }));
    });

    // languageFeaturesService
    console.log('AiEditorContribution:>>>', editor, monacoEditor);

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

    this.disposables.push(monacoEditor.onDidChangeModelContent((event) => {
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
      const hasKeyPosition: Position[] = []

      // 遍历匹配结果并输出位置信息
      for (const match of matches) {
        // const startPosition = model.getPositionAt(match.index!);
        const endPosition = model.getPositionAt(match.index! + match[0].length);
        hasKeyPosition.push(endPosition);
      }


      // @ts-ignore
      const symbols = this.documentSymbolStore.getDocumentSymbol(model.uri!);

      console.log('documentSymbolStore: symbols>>> ', symbols)
      const findRange = (range: Position) => {
        if (!symbols) {
          return { range: null }
        }
        return symbols.map(obj => 
          (obj.range.startLineNumber === range.lineNumber ? obj : null) 
          || (obj.children || []).find(child => child.range.startLineNumber === range.lineNumber)).filter(Boolean)[0];
      }

      if (hasKeyPosition.length > 0) {

        inlayHintDispose = monaco.languages.registerInlayHintsProvider(model.getLanguageId(), {
          provideInlayHints(model, range, token) {
            return {
              hints: hasKeyPosition.map(position => {

                return {
                  kind: monaco.languages.InlayHintKind.Parameter,
                  position: { column: position.column, lineNumber: position.lineNumber },
                  label: [
                    {
                      label: '✨ Suggest documentation',
                      command: {
                        id: 'ai.suggest.documentation',
                        title: '',
                        arguments: [findRange(position)?.range]
                      }
                    }
                  ],
                  paddingLeft: true
                }
              }),
              dispose: () => { },
            };
          }
        })

        this.disposables.push(inlayHintDispose);
      }
    }))
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

    this.disposables.push(monacoEditor.onDidChangeModel(() => {
      if (dispose) {
        dispose.dispose();
      }
    }))

    this.disposables.push(Event.debounce(monacoEditor.onDidChangeModelContent, (_, e) => e, 1000)(async (event) => {
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

      // 补全上文
      const startRange = new monaco.Range(
        // 限制在 500 行内
        Math.max(position.lineNumber - 500, 0),
        Number.MAX_SAFE_INTEGER,
        position.lineNumber,
        position.column
      )
      const prompt = model.getValueInRange(startRange);
      
      // 补全下文
      const endRange = new monaco.Range(
        position.lineNumber,
        position.column,
        model.getLineCount(),
        Number.MAX_SAFE_INTEGER
      )
      const suffix = model.getValueInRange(endRange);

      const uid = uuid();

      const language = model.getLanguageId();

      const completionResult = await this.aiGPTBackService.aiCompletionRequest({
        prompt,
        suffix,
        sessionId: uid,
        language,
        fileUrl: model.uri.toString().split('/').pop(),
      })

      dispose = monaco.languages.registerInlineCompletionsProvider(model.getLanguageId(), {
        provideInlineCompletions(model, position, context, token) {
          const items = completionResult.data.codeModelList;
          return {
            items: items.map(data => ({
              insertText: data.content
            }))
          };
        },
        freeInlineCompletions(completions: InlineCompletions<InlineCompletion>) {
          // console.log('freeInlineCompletions:>> ', completions)
        }
      })
      
      this.disposables.push(dispose);

      console.log('onDidChangeModelContent:>>> 参数', {
        prompt,
        suffix,
        uid,
        language,
      });
      
      console.log('onDidChangeModelContent:>>> ai 补全返回结果', completionResult);
    }))
  }
}
