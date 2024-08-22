import React, { useEffect, useRef } from 'react';

import { Injectable } from '@opensumi/di';
import { Event, MonacoService, useInjectable } from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { IEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ILanguageSelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

const editorOptions: IEditorOptions = {
  fixedOverflowWidgets: true,
  readOnly: false,
  lineNumbers: 'on',
  glyphMargin: true,

  scrollBeyondLastLine: false,
  rulers: undefined,
  overviewRulerBorder: undefined,
  overviewRulerLanes: 0,
  padding: { top: 0, bottom: 0 },
  folding: false,
  stickyScroll: { enabled: false },
  minimap: { enabled: false },
  automaticLayout: true,

  scrollbar: {
    horizontal: void 0,
    vertical: void 0,
    horizontalScrollbarSize: 0,
    verticalScrollbarSize: 0,
    arrowSize: 0,
    verticalSliderSize: 0,
    horizontalSliderSize: 0,
    ignoreHorizontalScrollbarInContentHeight: true,
  },
  hover: {
    enabled: false,
  },
};

interface IVirtualEditorHandler {
  getVirtualModel: () => monaco.editor.ITextModel;
}

interface IVirtualEditorProviderProps {
  editor: ICodeEditor;
  onReady?: (handler: IVirtualEditorHandler) => void;
}

const VirtualEditorProvider = React.memo((props: IVirtualEditorProviderProps) => {
  const { editor, onReady } = props;
  const monacoService: MonacoService = useInjectable(MonacoService);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const model: ITextModel | null = editor.getModel();

    if (!model) {
      return;
    }

    const virtualEditor = monacoService.createCodeEditor(editorRef.current!, {
      ...editorOptions,
      lineDecorationsWidth: editor.getLayoutInfo().decorationsWidth,
      lineNumbersMinChars: editor.getOption(monaco.editor.EditorOption.lineNumbersMinChars),
    });

    const modelService = StandaloneServices.get(IModelService);
    const languageSelection: ILanguageSelection = { languageId: model.getLanguageId(), onDidChange: Event.None };

    const virtualModel = modelService.createModel('', languageSelection);

    virtualEditor.setModel(virtualModel);

    if (onReady) {
      onReady({
        getVirtualModel: () => virtualModel,
      });
    }

    return () => {
      if (virtualEditor) {
        virtualEditor.dispose();
      }
    };
  }, [editor]);

  return <div ref={editorRef}></div>;
});

@Injectable({ multiple: true })
export class RewriteWidget extends ReactInlineContentWidget {
  private virtualModel: monaco.editor.ITextModel | null = null;

  public renderView(): React.ReactNode {
    return (
      <VirtualEditorProvider
        editor={this.editor}
        onReady={(handler) => {
          this.virtualModel = handler.getVirtualModel();
        }}
      />
    );
  }
  public id(): string {
    return 'RewriteWidget';
  }

  public getModel(): ITextModel {
    return this.virtualModel!;
  }
}
