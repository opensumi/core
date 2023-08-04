import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next';
import { IDisposable, URI, MaybePromise, Disposable, Event } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { AiGPTBackSerivcePath } from '@opensumi/ide-startup/lib/common/index';
import { editor as MonacoEditor } from '@opensumi/monaco-editor-core';

import { AiImproveWidget } from './ai-improve-widget';
import { AiZoneWidget } from './ai-zone-widget';
import { AiDiffWidget } from './diff-widget/ai-diff-widget';

@Injectable()
export class AiEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AbstractMenuService)
  private readonly abstractMenuService: AbstractMenuService;

  @Autowired(AiGPTBackSerivcePath)
  private readonly aiGPTBackService: any;

  public menuse: any;

  contribute(editor: IEditor): IDisposable {
    if (!editor) {
      return this;
    }

    const { monacoEditor, currentUri, currentDocumentModel } = editor;
    if (currentUri && currentUri.codeUri.scheme !== 'file') {
      return this;
    }

    let aiZoneWidget: AiZoneWidget | undefined;
    let aiDiffWidget: AiDiffWidget | undefined;
    let aiImproveWidget: AiImproveWidget | undefined;

    monacoEditor.onDidChangeModel(() => {
      if (aiZoneWidget) {
        aiZoneWidget.dispose();
      }
      if (aiDiffWidget) {
        aiDiffWidget.dispose();
      }
      if (aiImproveWidget) {
        aiImproveWidget.dispose();
      }
    });

    Event.debounce(
      Event.any(
        monacoEditor.onDidChangeCursorSelection,
        // @ts-ignore
        // monacoEditor.onMouseUp
      ),
      (_, e) => e,
      100,
    )((e) => {

      if (!this.menuse) {
        this.menuse = this.abstractMenuService.createMenu('ai/iconMenubar/context');
      }

      const selection = monacoEditor.getSelection();

      if (!selection) {
        return;
      }

      const { startLineNumber, endLineNumber } = selection;
      // 获取指定范围内的文本内容
      const text = monacoEditor.getModel()?.getValueInRange(selection);

      if (!text) {
        return;
      }

      if (aiZoneWidget) {
        aiZoneWidget.dispose();
      }

      if (aiDiffWidget) {
        aiDiffWidget.dispose();
      }

      if (aiImproveWidget) {
        aiImproveWidget.dispose();
      }

      console.log('monacoEditor.onMouseUp: >>> text', text);

      aiZoneWidget = this.injector.get(AiZoneWidget, [monacoEditor!, this.menuse]);
      aiZoneWidget.create();

      // aiZoneWidget.showByLine(startLineNumber - 1);
      aiZoneWidget.showByLine(endLineNumber);

      this.disposables.push(aiZoneWidget.onSelectChange(async (value) => {

        if (aiDiffWidget) {
          aiDiffWidget.dispose();
        }

        // gpt 模型测试
        if (value) {
          const result = await this.aiGPTBackService.aiGPTcompletionRequest(`${value}, 要求只回答代码内容，不需要其他信息，代码内容是: \n` + text);
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
}
