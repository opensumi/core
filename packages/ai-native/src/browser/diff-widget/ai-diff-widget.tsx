import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, URI, useInjectable, uuid } from '@opensumi/ide-core-browser';
import { ConfigProvider } from '@opensumi/ide-core-browser';
import { EditorCollectionService, IDiffEditor } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

const diffEditorOptions: IDiffEditorOptions = {
  fixedOverflowWidgets: true,
  readOnly: true,
  enableSplitViewResizing: true,
  ignoreTrimWhitespace: false,
  renderSideBySide: true,
  lineNumbers: 'on',
  glyphMargin: true,

  scrollbar: { useShadows: false, alwaysConsumeMouseWheel: false },
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
  dto: { originValue; modifiedValue; languageId } | undefined;
  onMaxLincCount: (n) => void;
  editor: ICodeEditor;
}

const DiffContentProvider = React.memo((props: IDiffContentProviderProps) => {
  const { dto, onMaxLincCount, editor } = props;
  const documentModelService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
  const editorCollectionService: EditorCollectionService = useInjectable(EditorCollectionService);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dto) {
      return;
    }

    let diffEditor: IDiffEditor;

    const uid = uuid(4);
    const originUri = URI.parse(`AI://origin${uid}`);
    const actualUri = URI.parse(`AI://modified${uid}`);

    Promise.all([
      documentModelService.createModelReference(originUri),
      documentModelService.createModelReference(actualUri),
    ]).then((data) => {
      const [original, modified] = data;
      if (!original) {
        return;
      }

      const { originValue, modifiedValue, languageId } = dto!;

      diffEditor = editorCollectionService.createDiffEditor(editorRef.current!, {
        ...diffEditorOptions,
        lineDecorationsWidth: editor.getLayoutInfo().decorationsWidth,
      });

      const originalModel = original.instance.getMonacoModel();
      const modifiedModel = modified.instance.getMonacoModel();

      originalModel.setMode(languageId);
      modifiedModel.setMode(languageId);

      originalModel.setValue(originValue);
      modifiedModel.setValue(modifiedValue);

      diffEditor.compare(original, modified);
      diffEditor.originalEditor.monacoEditor.setModel(originalModel);
      diffEditor.modifiedEditor.monacoEditor.setModel(modifiedModel);

      diffEditor.originalEditor.monacoEditor.updateOptions({ readOnly: true });
      diffEditor.modifiedEditor.monacoEditor.updateOptions({ readOnly: true });

      if (onMaxLincCount) {
        const { originalEditor, modifiedEditor } = diffEditor;

        const originContentHeight = originalEditor.monacoEditor.getContentHeight();
        const originLineCount =
          originContentHeight / originalEditor.monacoEditor.getOption(monaco.editor.EditorOption.lineHeight);

        const modifiedContentHeight = modifiedEditor.monacoEditor.getContentHeight();
        const modifiedLineCount =
          modifiedContentHeight / modifiedEditor.monacoEditor.getOption(monaco.editor.EditorOption.lineHeight);

        onMaxLincCount(Math.max(originLineCount, modifiedLineCount) + 1);
      }
    });

    return () => {
      if (diffEditor) {
        diffEditor.dispose();
      }
    };
  }, [dto]);

  const styles: React.CSSProperties = {
    borderTop: '1px solid rgba(255,255,255,0.15)',
    borderBottom: '1px solid rgba(255,255,255,0.15)',
    height: 'inherit',
    width: '100%',
  };

  return <div ref={editorRef} style={styles}></div>;
});

@Injectable({ multiple: true })
export class AiDiffWidget extends ZoneWidget {
  public static readonly _hideId = 'overlayDiff';

  @Autowired(AppConfig)
  private configContext: AppConfig;

  private recordLine: number;

  private originValue: string;
  private modifiedValue: string;
  private languageId: string;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('ai_diff-widget');

    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <DiffContentProvider
            dto={{ originValue: this.originValue, modifiedValue: this.modifiedValue, languageId: this.languageId }}
            editor={this.editor}
            onMaxLincCount={(n) => {
              if (n) {
                this._relayout(n);
              }
            }}
          />
        </div>
      </ConfigProvider>,
      container,
    );
  }

  constructor(editor: ICodeEditor, originValue: string, modifiedValue: string, languageId: string) {
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      // 这里有个小坑，如果不开启这个配置，那么在调用 show 函数的时候会自动对焦并滚动到对应 range，导致在编辑 result 视图中代码时光标总是滚动在最后一个 widget 上
      keepEditorSelection: true,
    });

    this.originValue = originValue;
    this.modifiedValue = modifiedValue;
    this.languageId = languageId;
  }

  // 覆写 revealLine 函数，使其在 show 的时候编辑器不会定位到对应位置
  protected override revealLine(lineNumber: number, isLastLine: boolean): void {
    // not implement
  }

  public getRecordLine(): number {
    return this.recordLine;
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
    this.editor.setHiddenAreas([], AiDiffWidget._hideId);
    super.hide();
  }

  public showByLine(line: number, lineNumber = 20): void {
    this.recordLine = line;

    /**
     * 由于 monaco 在最新的版本中支持了 showInHiddenAreas 选项（见：https://github.com/microsoft/vscode/pull/181029），具备了在空白行显示 zonewidget 的能力
     * 所以这里暂时通过 hack 的方式使其能让 zonewidget 在空白处显示出来，后续需要升级 monaco 来实现
     */
    // @ts-ignore
    this.editor._modelData.viewModel.coordinatesConverter.modelPositionIsVisible = () => true;

    super.show(
      {
        startLineNumber: line,
        startColumn: 0,
        endLineNumber: line,
        endColumn: Number.MAX_SAFE_INTEGER,
      },
      lineNumber,
    );
  }
}
