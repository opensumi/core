import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-core-browser';
import { IDisposable, URI, MaybePromise, Disposable, Event } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { ITextModel } from '@opensumi/ide-monaco';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { editor as MonacoEditor } from '@opensumi/monaco-editor-core';
import { CancellationToken } from '@opensumi/monaco-editor-core/esm/vs/base/common/cancellation';
import { ProviderResult, CodeLensList } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import { AiZoneWidget } from './ai-zone-widget';
import { AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next';

@Injectable()
export class AiEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(WorkbenchEditorServiceImpl)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AbstractMenuService)
  private readonly abstractMenuService: AbstractMenuService;

  contribute(editor: IEditor): IDisposable {
    if (!editor) {
      return this;
    }

    const { monacoEditor, currentUri, currentDocumentModel } = editor;

    let aiZoneWidget: AiZoneWidget | undefined;

    const menus = this.abstractMenuService.createMenu('ai/iconMenubar/context')

    monacoEditor.onDidChangeModel(() => {
      if (aiZoneWidget) {
        aiZoneWidget.dispose();
      }
    })

    Event.debounce(
      Event.any(
        monacoEditor.onDidChangeCursorSelection,
        // @ts-ignore
        monacoEditor.onMouseUp
      ),
      (_, e) => e,
      100,
    )((e) => {

      const selection = monacoEditor.getSelection();

      if (!selection) {
        return;
      }

      const { startLineNumber, endLineNumber } = selection;

      if (aiZoneWidget) {
        aiZoneWidget.dispose();
      }

      // 获取指定范围内的文本内容
      const text = monacoEditor.getModel()?.getValueInRange(selection);
      console.log('monacoEditor.onMouseUp: >>> text', text)

      aiZoneWidget = this.injector.get(AiZoneWidget, [monacoEditor!, menus]);
      aiZoneWidget.create();

      aiZoneWidget.showByLine(startLineNumber - 1);
      console.log('monacoEditor.onMouseUp', e)
      // 聚焦到第 5 行
      monacoEditor.revealLine(5);
    })

    // languageFeaturesService
    console.log('AiEditorContribution:>>>', editor, monacoEditor)

    return this;
  }
  provideEditorOptionsForUri?(uri: URI): MaybePromise<Partial<MonacoEditor.IEditorOptions>> {
    throw new Error('Method not implemented.');
  }
}
