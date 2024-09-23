import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import {
  AppConfig,
  ConfigProvider,
  Emitter,
  Event,
  MonacoService,
  Schemes,
  randomString,
  useInjectable,
} from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ILanguageSelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { IDiffPreviewerOptions, IInlineDiffPreviewerNode } from './inline-diff-previewer';
import styles from './inline-diff-widget.module.less';

const diffEditorOptions: IDiffEditorOptions = {
  fixedOverflowWidgets: true,
  readOnly: false,
  enableSplitViewResizing: true,
  ignoreTrimWhitespace: true,
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
  automaticLayout: true,
  renderIndicators: false,
  inDiffEditor: true,
};

interface IDiffWidgetHandler {
  getModifiedModel: () => monaco.editor.ITextModel;
  getOriginModel: () => monaco.editor.ITextModel;
  layout: () => void;
}

interface IDiffContentProviderProps {
  range: monaco.IRange;
  /**
   * 获取最大行数
   */
  onMaxLineCount: (n: number) => void;

  onReady?: (handler: IDiffWidgetHandler) => void;

  editor: ICodeEditor;
}

const DiffContentProvider = React.memo((props: IDiffContentProviderProps) => {
  const { range, onMaxLineCount, editor, onReady } = props;
  const monacoService: MonacoService = useInjectable(MonacoService);
  const diffEditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!range) {
      return;
    }

    const model: ITextModel | null = editor.getModel();

    if (!model) {
      return;
    }

    const codeValueInRange = model.getValueInRange(range);
    const diffEditor = monacoService.createDiffEditor(diffEditorRef.current!, {
      ...diffEditorOptions,
      lineDecorationsWidth: editor.getLayoutInfo().decorationsWidth,
      lineNumbersMinChars: editor.getOption(monaco.editor.EditorOption.lineNumbersMinChars),
    });

    const modelService = StandaloneServices.get(IModelService);
    const languageSelection: ILanguageSelection = { languageId: model.getLanguageId(), onDidChange: Event.None };

    const originalModel = modelService.createModel(
      codeValueInRange,
      languageSelection,
      monaco.Uri.from({
        scheme: Schemes.inMemory,
        path: 'inline-diff-widget/' + randomString(8),
      }),
      true,
    );
    const modifiedModel = modelService.createModel(
      '',
      languageSelection,
      monaco.Uri.from({
        scheme: Schemes.inMemory,
        path: 'inline-diff-widget/' + randomString(8),
      }),
      true,
    );

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    diffEditor.revealLine(range.startLineNumber, monaco.editor.ScrollType.Immediate);

    const layout = () => {
      if (onMaxLineCount) {
        const originLineCount = originalModel.getLineCount();
        const modifiedLineCount = modifiedModel.getLineCount();

        onMaxLineCount(Math.max(originLineCount, modifiedLineCount) + 1);
      }
    };

    if (onReady) {
      onReady({
        getModifiedModel: () => modifiedModel,
        getOriginModel: () => originalModel,
        layout,
      });
    }

    layout();

    return () => {
      if (diffEditor) {
        diffEditor.dispose();
      }
    };
  }, [range, editor]);

  return <div ref={diffEditorRef} className={styles.diff_editor_widget}></div>;
});

@Injectable({ multiple: true })
export class InlineDiffWidget extends ZoneWidget implements IInlineDiffPreviewerNode {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  private readonly _onMaxLineCount = new Emitter<number>();
  public readonly onMaxLineCount: Event<number> = this._onMaxLineCount.event;

  private readonly _onReady = new Emitter<void>();
  public readonly onReady: Event<void> = this._onReady.event;

  private range: monaco.IRange;
  private root: ReactDOMClient.Root | null;
  private diffWidgetHandler: IDiffWidgetHandler | null = null;
  private resultContainer: HTMLDivElement | null = null;
  private hiddenArea: monaco.languages.IRange;

  previewerOptions: IDiffPreviewerOptions;
  setPreviewerOptions(options: IDiffPreviewerOptions): void {
    this.previewerOptions = options;
  }

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('inline-diff-widget');
    this.root = ReactDOMClient.createRoot(container);

    let portal: React.ReactNode | null = null;

    if (this._resolveResultWidget) {
      if (container.parentNode) {
        const resultContainer = document.createElement('div');
        requestAnimationFrame(() => {
          resultContainer.className = styles.ai_diff_editor_resolve_result_widget;
          const layoutInfo = this.editor.getLayoutInfo();
          resultContainer.style.width = `${layoutInfo.contentWidth}px`;
          resultContainer.style.left = `${layoutInfo.contentLeft}px`;
        });
        container.parentNode.appendChild(resultContainer);
        portal = createPortal(this._resolveResultWidget, resultContainer);
        this.resultContainer = resultContainer;
      } else {
        throw new Error('[impossible path] container.parentNode is null');
      }
    }

    this.root.render(
      <ConfigProvider value={this.configContext}>
        <div className={styles.ai_diff_editor_container}>
          <DiffContentProvider
            range={this.range}
            editor={this.editor}
            onMaxLineCount={(n) => {
              if (n) {
                this._relayout(n);
                this._onMaxLineCount.fire(n);
              }
            }}
            onReady={(handler) => {
              this.diffWidgetHandler = handler;
              this._onReady.fire();
            }}
          />
        </div>
        {portal}
      </ConfigProvider>,
    );
  }

  computeResultWidgetWidth(): number {
    const layoutInfo = this.editor.getLayoutInfo();
    return layoutInfo.contentWidth + layoutInfo.contentLeft;
  }

  override _onWidth(widthInPixel: number): void {
    super._onWidth(widthInPixel);
    requestAnimationFrame(() => {
      if (this.resultContainer) {
        this.resultContainer.style.width = `${this.computeResultWidgetWidth()}px`;
      }
    });
  }

  getModifiedModel(): monaco.editor.ITextModel | undefined {
    return this.diffWidgetHandler?.getModifiedModel();
  }

  getOriginModel(): monaco.editor.ITextModel | undefined {
    return this.diffWidgetHandler?.getOriginModel();
  }

  layout(): void {
    return this.diffWidgetHandler?.layout();
  }

  constructor(
    protected id: string,
    options: {
      editor: ICodeEditor;
      selection: monaco.IRange;
      hiddenArea?: monaco.IRange;
    },
  ) {
    super(options.editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      keepEditorSelection: true,
      showInHiddenAreas: true,
    });

    const { selection, hiddenArea, editor } = options;

    this.range = selection;
    this.hiddenArea = hiddenArea || selection;

    editor.setHiddenAreas([this.hiddenArea], this.id);
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
    this.editor.setHiddenAreas([], this.id);
    super.hide();
    if (this.root) {
      this.root.unmount();
    }
  }

  /**
   *
   * @param line 视图区域的起始行号
   * @param heightInLines 视图区域的高度（以行数表示）
   */
  public showByLine(line: number, heightInLines = 20): void {
    /**
     * 暂时通过 hack 的方式使其能让 zonewidget 在空白处显示出来
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
      heightInLines,
    );
  }

  protected _resolveResultWidget: React.ReactElement | null = null;
  setResolveResultWidget(widget: React.ReactElement) {
    this._resolveResultWidget = widget;
  }
}
