import React, { CSSProperties, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, Uri, URI, useInjectable } from '@opensumi/ide-core-browser';
import { ConfigProvider } from '@opensumi/ide-core-browser';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';
import { EditorCollectionService, IDiffEditor } from '@opensumi/ide-editor';
import { getSimpleEditorOptions } from '@opensumi/ide-editor';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { monaco, URI as MonacoURI } from '@opensumi/ide-monaco/lib/browser/monaco-api';

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
  renderOverviewRuler: false,
  ignoreTrimWhitespace: false,
  renderSideBySide: true,
};

const DiffContentProvider = React.memo(((props: { dto: { originValue } | undefined }) => {
  let { dto } = props;
  const documentModelService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
  const editorCollectionService: EditorCollectionService = useInjectable(EditorCollectionService);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dto) {
      return;
    }
    
    let diffEditor: IDiffEditor;

    const random = Math.random() * 10;
    // const originUri = Uri.parse(`AI://origin${random}`);
    // const actualUri = Uri.parse(`AI://modified${random}`);
    const originUri = URI.parse(`AI://origin${random}`);
    const actualUri = URI.parse(`AI://modified${random}`);

    Promise.all([
      documentModelService.createModelReference(originUri),
      documentModelService.createModelReference(actualUri),
    ]).then((data) => {
      const [original, modified] = data;
      if (!original) {
        return;
      }

      const { originValue } = dto!;

      diffEditor = editorCollectionService.createDiffEditor(editorRef.current!, {
        ...getSimpleEditorOptions(),
        ...diffEditorOptions,
      });

      const originalModel = original.instance.getMonacoModel();
      const modifiedModel = modified.instance.getMonacoModel();
      
      originalModel.setMode('java')
      modifiedModel.setMode('java')

      originalModel.setValue(originValue);

      const mockModifiedValue = originValue + ' >>>>>';
      modifiedModel.setValue(mockModifiedValue);

      diffEditor.compare(original, modified);
      diffEditor.originalEditor.monacoEditor.setModel(originalModel);
      diffEditor.modifiedEditor.monacoEditor.setModel(modifiedModel);
    });

    return () => {
      if (diffEditor) {
        diffEditor.dispose();
      }
    };
  }, [dto]);

  return <div ref={editorRef} style={{ height: 'inherit', width:'100%', border:'1px solid #6666' }}></div>;
});

const styles: CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
};

@Injectable({ multiple: true })
export class AiDiffWidget extends ZoneWidget {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  private recordLine: number;
  private originValue: string;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('ai_diff-widget');

    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
          <div style={styles}>
            <DiffContentProvider dto={{ originValue: this.originValue }}/>
          </div>
      </ConfigProvider>,
      container,
    );
  }

  constructor(editor: ICodeEditor, originValue: string) {
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      // 这里有个小坑，如果不开启这个配置，那么在调用 show 函数的时候会自动对焦并滚动到对应 range，导致在编辑 result 视图中代码时光标总是滚动在最后一个 widget 上
      keepEditorSelection: true,
    });

    this.originValue = originValue;
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

  public showByLine(line: number, lineNumber: number = 20): void {
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
