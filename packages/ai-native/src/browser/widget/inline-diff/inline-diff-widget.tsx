import React, { useEffect, useRef } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, ConfigProvider, Emitter, Event, MonacoService, useInjectable } from '@opensumi/ide-core-browser';
import { ICodeEditor } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ILanguageSelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import styles from './inline-diff-widget.module.less';

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
  dto:
    | {
        range: monaco.IRange;
        modifiedValue: string;
      }
    | undefined;
  onMaxLineCount: (n) => void;
  editor: ICodeEditor;
}

const DiffContentProvider = React.memo((props: IDiffContentProviderProps) => {
  const { dto, onMaxLineCount, editor } = props;
  const monacoService: MonacoService = useInjectable(MonacoService);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dto) {
      return;
    }

    const model: ITextModel | null = editor.getModel();

    if (!model) {
      return;
    }

    const { range, modifiedValue } = dto;

    const codeValueInRange = model.getValueInRange(range);
    const diffEditor = monacoService.createDiffEditor(editorRef.current!, {
      ...diffEditorOptions,
      lineDecorationsWidth: editor.getLayoutInfo().decorationsWidth,
      lineNumbersMinChars: editor.getOption(monaco.editor.EditorOption.lineNumbersMinChars),
    });

    const modelService = StandaloneServices.get(IModelService);
    const languageSelection: ILanguageSelection = { languageId: model.getLanguageId(), onDidChange: Event.None };

    const originalModel = modelService.createModel(codeValueInRange, languageSelection);
    const modifiedModel = modelService.createModel(modifiedValue, languageSelection);

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });
    diffEditor.revealLine(range.startLineNumber, monaco.editor.ScrollType.Immediate);

    if (onMaxLineCount) {
      const originalEditor = diffEditor.getOriginalEditor();
      const modifiedEditor = diffEditor.getModifiedEditor();

      const originContentHeight = originalEditor.getContentHeight();
      const originLineCount = originContentHeight / originalEditor.getOption(monacoApi.editor.EditorOption.lineHeight);

      const modifiedContentHeight = modifiedEditor.getContentHeight();
      const modifiedLineCount =
        modifiedContentHeight / modifiedEditor.getOption(monacoApi.editor.EditorOption.lineHeight);

      onMaxLineCount(Math.max(originLineCount, modifiedLineCount) + 1);
    }

    return () => {
      if (diffEditor) {
        diffEditor.dispose();
      }
    };
  }, [dto]);

  return <div ref={editorRef} className={styles.diff_editor_widget}></div>;
});

@Injectable({ multiple: true })
export class InlineDiffWidget extends ZoneWidget {
  public static readonly _hideId = 'overlayDiff';

  @Autowired(AppConfig)
  private configContext: AppConfig;

  private readonly _onMaxLineCount = new Emitter<number>();
  public readonly onMaxLineCount: Event<number> = this._onMaxLineCount.event;

  private range: monaco.IRange;
  private modifiedValue: string;
  private root: ReactDOMClient.Root | null;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('inline-diff-widget');
    this.root = ReactDOMClient.createRoot(container);

    this.root.render(
      <ConfigProvider value={this.configContext}>
        <div className={styles.ai_diff_editor_container}>
          <DiffContentProvider
            dto={{ range: this.range, modifiedValue: this.modifiedValue }}
            editor={this.editor}
            onMaxLineCount={(n) => {
              if (n) {
                this._relayout(n);
                this._onMaxLineCount.fire(n);
              }
            }}
          />
        </div>
      </ConfigProvider>,
    );
  }

  constructor(editor: ICodeEditor, selection: monaco.IRange, modifiedValue: string) {
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      keepEditorSelection: true,
      showInHiddenAreas: true,
    });

    this.range = selection;
    this.modifiedValue = modifiedValue;
  }

  // // 覆写 revealRange 函数，使其在 show 的时候编辑器不会定位到对应位置
  protected override revealRange(range: monaco.Range, isLastLine: boolean): void {
    // not implement
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
    this.editor.setHiddenAreas([], InlineDiffWidget._hideId);
    super.hide();
    if (this.root) {
      this.root.unmount();
    }
  }

  public showByLine(line: number, lineNumber = 20): void {
    /**
     * 暂时通过 hack 的方式使其能让 zonewidget 在空白处显示出来，后续需要升级 monaco 来实现
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
