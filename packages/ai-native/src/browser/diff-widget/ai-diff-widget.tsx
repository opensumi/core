import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, Emitter, Event, MonacoService, useInjectable } from '@opensumi/ide-core-browser';
import { ConfigProvider } from '@opensumi/ide-core-browser';
import { ICodeEditor } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ILanguageSelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import styles from './diff-widget.module.less';

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
        selection: monaco.Selection;
        modifiedValue: string;
      }
    | undefined;
  onMaxLincCount: (n) => void;
  editor: ICodeEditor;
}

const DiffContentProvider = React.memo((props: IDiffContentProviderProps) => {
  const { dto, onMaxLincCount, editor } = props;
  const monacoService: MonacoService = useInjectable(MonacoService);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dto) {
      return;
    }

    const model = editor.getModel();

    if (!model) {
      return;
    }

    const { selection, modifiedValue } = dto;

    const codeValueInRange = model.getValueInRange(selection);
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
    diffEditor.revealLine(selection.startLineNumber, monaco.editor.ScrollType.Immediate);

    if (onMaxLincCount) {
      const originalEditor = diffEditor.getOriginalEditor();
      const modifiedEditor = diffEditor.getModifiedEditor();

      const originContentHeight = originalEditor.getContentHeight();
      const originLineCount = originContentHeight / originalEditor.getOption(monacoApi.editor.EditorOption.lineHeight);

      const modifiedContentHeight = modifiedEditor.getContentHeight();
      const modifiedLineCount =
        modifiedContentHeight / modifiedEditor.getOption(monacoApi.editor.EditorOption.lineHeight);

      onMaxLincCount(Math.max(originLineCount, modifiedLineCount) + 1);
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
export class AiDiffWidget extends ZoneWidget {
  public static readonly _hideId = 'overlayDiff';

  @Autowired(AppConfig)
  private configContext: AppConfig;
  private readonly _onMaxLincCount = new Emitter<number>();
  public readonly onMaxLincCount: Event<number> = this._onMaxLincCount.event;

  private selection: monaco.Selection;
  private modifiedValue: string;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('ai_diff-widget');

    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <div className={styles.ai_diff_editor_container}>
          <DiffContentProvider
            dto={{ selection: this.selection, modifiedValue: this.modifiedValue }}
            editor={this.editor}
            onMaxLincCount={(n) => {
              if (n) {
                this._relayout(n);
                this._onMaxLincCount.fire(n);
              }
            }}
          />
        </div>
      </ConfigProvider>,
      container,
    );
  }

  constructor(editor: ICodeEditor, selection: monaco.Selection, modifiedValue: string) {
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      keepEditorSelection: true,
    });

    this.selection = selection;
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
    this.editor.setHiddenAreas([], AiDiffWidget._hideId);
    super.hide();
    if (this.container) {
      ReactDOM.unmountComponentAtNode(this.container!);
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
