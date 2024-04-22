import React, { useEffect, useRef } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, ConfigProvider, Emitter, Event, MonacoService, URI, uuid } from '@opensumi/ide-core-browser';
import { EditorCollectionService, IDiffEditor } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { ICodeEditor, ITextModel } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

import { EventFilter, StreamTransformer } from '../../../common/utils';

import styles from './inline-diff-widget.module.less';


function scrollToBottom(editor: ICodeEditor) {
  const editorElement = editor.getDomNode();

  if (editorElement) {
    // 获取编辑器内容的总高度
    const contentHeight = editor.getContentHeight();

    // 使用 setScrollTop 来滚动到最底部
    editor.setScrollTop(contentHeight);
  }
}

const diffEditorOptions: IDiffEditorOptions = {
  fixedOverflowWidgets: true,
  readOnly: true,
  enableSplitViewResizing: true,
  ignoreTrimWhitespace: false,
  renderSideBySide: true,
  lineNumbers: 'on',
  glyphMargin: true,

  scrollbar: { useShadows: false, alwaysConsumeMouseWheel: false, vertical: 'hidden' },
  scrollBeyondLastLine: false,
  renderMarginRevertIcon: false,
  renderOverviewRuler: false,
  rulers: undefined,
  overviewRulerBorder: undefined,
  overviewRulerLanes: 0,
  padding: { top: 0, bottom: 0 },
  folding: false,
  diffCodeLens: false,
  stickyScroll: { enabled: false },
  minimap: { enabled: false },
  renderLineHighlight: 'all',
  automaticLayout: true,
};

interface IDiffContentProviderProps {
  onDidRender(element: HTMLElement): void;
}

const DiffContentProvider = React.memo((props: IDiffContentProviderProps) => {
  const { onDidRender } = props;
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      onDidRender(editorRef.current);
    }
  }, [editorRef.current]);

  return <div ref={editorRef} className={styles.diff_editor_widget}></div>;
});

@Injectable({ multiple: true })
export class AIDiffWidget extends ZoneWidget {
  public static readonly _hideId = 'overlayDiff';

  @Autowired(AppConfig)
  private configContext: AppConfig;
  private readonly _onMaxLincCount = new Emitter<number>();
  public readonly onMaxLincCount: Event<number> = this._onMaxLincCount.event;

  @Autowired(MonacoService)
  protected readonly monacoService: MonacoService;

  @Autowired(IEditorDocumentModelService)
  protected readonly documentModelService: IEditorDocumentModelService;

  @Autowired(EditorCollectionService)
  protected readonly editorCollectionService: EditorCollectionService;

  private diffEditor: IDiffEditor;
  private originalModel: ITextModel;
  private modifiedModel: ITextModel;

  private root: ReactDOMClient.Root | null;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('ai_diff-widget');
    this.root = ReactDOMClient.createRoot(container);

    this.root.render(
      <ConfigProvider value={this.configContext}>
        <div className={styles.ai_diff_editor_container}>
          <DiffContentProvider onDidRender={this.onDidRender.bind(this)} />
        </div>
      </ConfigProvider>,
    );
  }

  constructor(
    editor: ICodeEditor,
    private selection: monaco.Selection,
    private modifiedValue: string | NodeJS.ReadableStream,
    private transformer?: StreamTransformer,
    private filter?: EventFilter,
  ) {
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      keepEditorSelection: true,
    });

    this.selection = selection;
    this.modifiedValue = modifiedValue;
    this.transformer = transformer;
  }

  private async onDidRender(element: HTMLElement) {
    const model = this.editor.getModel();
    if (!model) {
      return;
    }

    const uid = uuid(4);
    const originUri = URI.parse(`walkThroughSnippet://origin${uid}`);
    const actualUri = URI.parse(`walkThroughSnippet://modified${uid}`);

    const codeValueInRange = model.getValueInRange(this.selection);

    this.diffEditor = this.editorCollectionService.createDiffEditor(element, {
      ...diffEditorOptions,
      lineDecorationsWidth: this.editor.getLayoutInfo().decorationsWidth,
    });

    const [original, modified] = await Promise.all([
      this.documentModelService.createModelReference(originUri),
      this.documentModelService.createModelReference(actualUri),
    ]);

    this.originalModel = original.instance.getMonacoModel();
    this.modifiedModel = modified.instance.getMonacoModel();

    this.modifiedModel.onDidChangeContent(() => {
      //
    });

    this.originalModel.setLanguage(this.editor.getModel()?.getLanguageId()!);
    this.modifiedModel.setLanguage(this.editor.getModel()?.getLanguageId()!);

    this.diffEditor.originalEditor.monacoEditor.setModel(this.originalModel);
    this.diffEditor.modifiedEditor.monacoEditor.setModel(this.modifiedModel);

    this.diffEditor.originalEditor.monacoEditor.updateOptions({ readOnly: true });
    this.diffEditor.modifiedEditor.monacoEditor.updateOptions({ readOnly: false });

    this.originalModel.setValue(codeValueInRange);

    if (typeof this.modifiedValue === 'string') {
      this.modifiedModel.setValue(this.modifiedValue);
      this.diffEditor.compare(original, modified);
      this.diffEditor.focus();
    } else {
      if (!this.transformer) {
        throw new Error('Must provide a transformer for stream value!');
      }

      const event = this.filter
        ? this.filter(this.transformer(this.modifiedValue))
        : this.transformer(this.modifiedValue).event;

      event((chunk) => {
        if (chunk === '[DONE]') {
          return;
        }

        const lastLine = this.modifiedModel.getLineCount();
        const lastColumn = this.modifiedModel.getLineMaxColumn(lastLine);

        // 定义要插入内容的位置（文档末尾）
        const range = new monaco.Range(lastLine, lastColumn, lastLine, lastColumn);
        this.modifiedModel.pushEditOperations([], [{ range, text: chunk }], () => null);
        scrollToBottom(this.diffEditor.modifiedEditor.monacoEditor);
      });
    }
  }

  public setContainerStyle(style: { [key in string]: string }): void {
    const keys = Object.keys(style);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.container?.style, key)) {
        this.container!.style[key] = style[key];
      }
    }
  }

  public addClassName(type: string): this {
    this.setCssClass(type);
    return this;
  }

  public override dispose(): void {
    this.hide();
    super.dispose();
  }

  public override hide(): void {
    this.editor.setHiddenAreas([], AIDiffWidget._hideId);
    super.hide();
    if (this.root) {
      this.root.unmount();
    }
  }

  public showByLine(line: number, lineNumber = 20): void {
    /**
     * 由于 monaco 在最新的版本中支持了 showInHiddenAreas 选项（见：https://github.com/microsoft/vscode/pull/181029），具备了在空白行显示 zonewidget 的能力
     * 所以这里暂时通过 hack 的方式使其能让 zonewidget 在空白处显示出来，后续需要升级 monaco 来实现
     */
    // @ts-ignore
    this.editor._modelData.viewModel.coordinatesConverter.modelPositionIsVisible = () => true;

    super.show(
      {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: Number.MAX_SAFE_INTEGER,
      },
      lineNumber,
    );
  }
}
