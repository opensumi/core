import React, { CSSProperties, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, URI, useInjectable } from '@opensumi/ide-core-browser';
import { ConfigProvider } from '@opensumi/ide-core-browser';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { getSimpleEditorOptions } from '@opensumi/ide-editor';
import { ICodeEditor, IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

const diffEditorOptions: IDiffEditorOptions = {
  scrollBeyondLastLine: false,
  scrollbar: {
    verticalScrollbarSize: 14,
    horizontal: 'auto',
    useShadows: true,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    alwaysConsumeMouseWheel: false,
  },
  fixedOverflowWidgets: true,
  readOnly: true,
  minimap: {
    enabled: false,
  },
  enableSplitViewResizing: true,
  renderOverviewRuler: true,
  ignoreTrimWhitespace: false,
  renderSideBySide: true,
  lineNumbers: 'on',
  glyphMargin: false,
};

const CodeContentProvider = React.memo(
  (props: { dto: { answerValue; languageId } | undefined; onMaxLincCount: (n) => void }) => {
    const { dto, onMaxLincCount } = props;
    const documentModelService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
    const editorCollectionService: EditorCollectionService = useInjectable(EditorCollectionService);
    const editorRef = useRef<HTMLDivElement>(null);
    const { answerValue, languageId } = dto!;

    useEffect(() => {
      if (!dto) {
        return;
      }

      let codeEditor: ICodeEditor;

      const random = Math.random() * 10;
      const originUri = URI.parse(`AI://origin${random}`);

      documentModelService.createModelReference(originUri).then((data) => {
        const original = data;
        if (!original) {
          return;
        }

        codeEditor = editorCollectionService.createCodeEditor(editorRef.current!, {
          ...getSimpleEditorOptions(),
          ...diffEditorOptions,
        });

        const originalModel = original.instance.getMonacoModel();

        if (languageId) {
          originalModel.setMode(languageId);
        }

        originalModel.setValue(answerValue);

        codeEditor.monacoEditor.setModel(originalModel);
        codeEditor.monacoEditor.updateOptions({ readOnly: true });

        if (onMaxLincCount) {
          const { monacoEditor } = codeEditor;

          const contentHeight = monacoEditor.getContentHeight();
          const lineCount = contentHeight / monacoEditor.getOption(monaco.editor.EditorOption.lineHeight);

          onMaxLincCount(lineCount);
        }
      });

      return () => {
        if (codeEditor) {
          codeEditor.dispose();
        }
      };
    }, [dto]);

    return <div ref={editorRef} style={{ height: 'inherit', width: '100%', border: '1px solid #6666' }}></div>;
  },
);

const styles: CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'column',
  backgroundColor: 'rgba(38, 79, 120, 0.25)',
};

@Injectable({ multiple: true })
export class AiCodeWidget extends ZoneWidget {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  private recordLine: number;

  private answerValue: string;
  private languageId: string;
  private headUri: URI;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('ai_code-widget');

    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <div style={styles}>
          {this.headUri && (
            <div
              className={'ai_code_head'}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                whiteSpace: 'nowrap',
                padding: '3px 16px',
              }}
            >
              <span
                style={{
                  color: 'white',
                  marginRight: '10px',
                }}
              >
                {this.headUri.displayName}
              </span>
              <span>{this.headUri.codeUri.fsPath.replace(this.configContext.workspaceDir, '')}</span>
            </div>
          )}
          <CodeContentProvider
            dto={{ answerValue: this.answerValue, languageId: this.languageId }}
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

  constructor(editor: ICodeEditor) {
    // @ts-ignore
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      // 这里有个小坑，如果不开启这个配置，那么在调用 show 函数的时候会自动对焦并滚动到对应 range，导致在编辑 result 视图中代码时光标总是滚动在最后一个 widget 上
      keepEditorSelection: true,
    });
  }

  public setAnswerValue(answerValue: string): void {
    this.answerValue = answerValue;
  }

  public setHeadUri(headUri: string): void {
    this.headUri = URI.parse(headUri);
  }

  public setLanguageId(id: string): void {
    this.languageId = id;
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

  public showByLine(line: number, lineNumber = 20): void {
    this.recordLine = line;
    super.hide();
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
