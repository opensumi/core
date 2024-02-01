import debounce from 'lodash/debounce';

import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { message } from '@opensumi/ide-components';
import { AiNativeConfigService, ClientAppContribution, MergeConflictRT } from '@opensumi/ide-core-browser';
import { MergeConflictReportService } from '@opensumi/ide-core-browser/lib/ai-native/conflict-report.service';
import {
  Disposable,
  Schemes,
  Domain,
  CommandContribution,
  CommandRegistry,
  Command,
  MaybePromise,
  IEventBus,
  ExtensionActivatedEvent,
  localize,
  Uri,
  ConstructorOf,
  CancellationTokenSource,
  IRange,
  Emitter,
  Event,
  Constants,
  CommandService,
} from '@opensumi/ide-core-common';
import { AiBackSerivcePath, IAiBackService, IAiBackServiceResponse } from '@opensumi/ide-core-common/lib/ai-native';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { ITextModel } from '@opensumi/ide-monaco';
import { BaseInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/content-widget';
import { LineRange } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/model/line-range';
import {
  AI_RESOLVE_REGENERATE_ACTIONS,
  IConflictActionsEvent,
  IGNORE_ACTIONS,
  REVOKE_ACTIONS,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/types';
import { ResultCodeEditor } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/view/editors/resultCodeEditor';
import styles from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/view/merge-editor.module.less';
import { StopWidget } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/widget/stop-widget';
import { ICodeEditor, IModelDeltaDecoration } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import { IValidEditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { CacheConflict, DocumentMergeConflict, IConflictCache } from './cache-conflicts';
import { OverrideResolveResultWidget as ResolveResultWidget } from './override-resolve-result-widget';
import { CommitType } from './types';
export namespace MERGE_CONFLICT {
  const CATEGORY = 'MergeConflict';
  export const AI_ACCEPT: Command = {
    id: 'merge-conflict.ai.accept',
    category: CATEGORY,
  };
  export const ALL_RESET: Command = {
    id: 'merge-conflict.ai.all-reset',
    category: CATEGORY,
  };
  export const AI_ALL_ACCEPT: Command = {
    id: 'merge-conflict.ai.all-accept',
    category: CATEGORY,
  };
  export const AI_ALL_ACCEPT_STOP: Command = {
    id: 'merge-conflict.ai.all-accept-stop',
    category: CATEGORY,
  };
}

// codelens 无法定义样式 此处通过 css hack
const cssStyle = `
.monaco-editor .codelens-decoration {
  & > a[title*=AI] {
    background-image: radial-gradient(circle at -21% -22%, #00f6ff, #9c03ff);
    color: transparent;
    background-clip: text;
  }
  & > a[title*=AI]:hover {
    background-image: radial-gradient(circle at -21% -22%, #00f6ff, #9c03ff);
    color: transparent !important;
    background-clip: text;
  }
  .codicon-ai-magic::before {
    font-family: 'kaitian-icon';
    content: "\\e60e";
  }
  .codicon-ai-magic {
    font: normal normal normal 16px/1 'kaitian-icon';
    display: inline-block;
    text-decoration: none;
    text-rendering: auto;
    text-align: center;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    user-select: none;
    -webkit-user-select: none;
  }
  .codicon-modifier-spin {
    color: #00f6ff !important;
  }
}
`;

function loadStyleString(load: boolean) {
  let mergeConflictStyleNode = document.getElementById('merge-conflict-codlens-style');
  if (!load) {
    mergeConflictStyleNode?.remove();
    return;
  }
  if (!mergeConflictStyleNode && load) {
    mergeConflictStyleNode = document.createElement('style');
    mergeConflictStyleNode.id = 'merge-conflict-codelens-style';
    mergeConflictStyleNode.appendChild(document.createTextNode(cssStyle));
    document.getElementsByTagName('head')[0].appendChild(mergeConflictStyleNode);
  }
}

interface IWidgetFactory {
  hideWidget(id?: string): void;
  addWidget(range: LineRange): void;
  hasWidget(range: LineRange): boolean;
}

interface ICacheResolvedConflicts extends IValidEditOperation {
  newRange: IRange;
  id: string;
  conflictText: string;
  isAccept?: boolean;
  isClosed?: boolean;
}

interface ICacheAIResolvedConflicts {
  id: string;
  range: IRange;
  text: string;
}

interface IRequestCancel {
  id: string;
  type: 'cancel';
}

class WidgetFactory implements IWidgetFactory {
  private widgetMap: Map<string, BaseInlineContentWidget>;

  constructor(
    private contentWidget: ConstructorOf<BaseInlineContentWidget>,
    private editor: ResultCodeEditor,
    private injector: Injector,
  ) {
    this.widgetMap = new Map();
  }

  hasWidget(range: LineRange): boolean {
    return this.widgetMap.get(range.id) !== undefined;
  }

  public hideWidget(id?: string): void {
    if (id) {
      const widget = this.widgetMap.get(id);
      if (widget) {
        widget.hide();
        this.widgetMap.delete(id);
      }
      return;
    }

    this.widgetMap.forEach((widget) => {
      widget.hide();
    });
    this.widgetMap.clear();
  }

  public addWidget(range: LineRange): void {
    const id = range.id;
    if (this.widgetMap.has(id)) {
      return;
    }

    const position = new Position(range.endLineNumberExclusive, 1);

    const widget = this.injector.get(this.contentWidget, [this.editor, range]);
    widget.show({ position });

    this.widgetMap.set(id, widget);
  }
}

interface IReportData extends Partial<MergeConflictRT> {
  relationId?: string;
}

@Domain(CommandContribution, ClientAppContribution)
export class MergeConflictContribution extends Disposable implements CommandContribution, ClientAppContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(AiNativeConfigService)
  private readonly aiNativeConfigService: AiNativeConfigService;

  @Autowired()
  private readonly cacheConflicts: CacheConflict;

  @Autowired(AiBackSerivcePath)
  private aiBackService: IAiBackService;

  @Autowired(MergeConflictReportService)
  private readonly mergeConflictReportService: MergeConflictReportService;

  private resolveResultWidgetManager: IWidgetFactory;
  private stopWidgetManager: IWidgetFactory;

  private cancelIndicatorMap: Map<string, CancellationTokenSource> = new Map();
  private cacheResolvedConflicts: Map<string, Map<string, ICacheResolvedConflicts>> = new Map();

  private readonly _onRequestCancel = new Emitter<IRequestCancel>();
  public readonly onRequestCancel: Event<IRequestCancel> = this._onRequestCancel.event;

  private readonly _onRequestsCancel = new Emitter<IRequestCancel[]>();
  public readonly onRequestsCancel: Event<IRequestCancel[]> = this._onRequestsCancel.event;

  // for widget
  private editor: ICodeEditor;
  // for codelens loading
  private loadingRange: Set<IRange> = new Set();
  // for report
  private currentReportMap = new Map<string, IReportData>();
  private uri2RelationId = new Map<string, string>();

  constructor() {
    super();
  }

  dispose() {
    super.dispose();
    this.cancelRequestToken();
    this.mergeConflictReportService.dispose();
    this.cacheConflicts.dispose();
  }

  private initListenEvent(): void {
    if (this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      this.disposables.push(
        this.editor.onDidChangeModelContent(({ changes, eol }) => {
          const deltaEdits: Array<{ startLineNumber: number; endLineNumber: number; offset: number }> = [];
          changes.forEach((change) => {
            const { text, range } = change;
            const textLineCount = (text.match(new RegExp(eol, 'ig')) ?? []).length;
            const { startLineNumber, endLineNumber } = range;

            /**
             * startLineNumber 与 endLineNumber 的差值表示选区选了多少行
             * textLineCount 则表示文本出现的换行符数量
             * 两者相加就得出此次文本变更最终新增或减少了多少行
             */
            const offset = startLineNumber - endLineNumber + textLineCount;
            if (offset === 0) {
              return;
            }

            deltaEdits.push({
              startLineNumber,
              endLineNumber,
              offset,
            });
          });
          deltaEdits.forEach((edits) => {
            const map: Map<string, ICacheResolvedConflicts> = new Map();
            const { startLineNumber, endLineNumber, offset } = edits;

            for (const [id, value] of this.getCacheResolvedConflicts().entries()) {
              const { newRange } = value;
              const {
                startLineNumber: newStartLineNumber,
                endLineNumber: newEndLineNumber,
                endColumn: newEndColumn,
              } = newRange;
              // 在冲突位置下方改动 不处理
              if (newEndLineNumber < startLineNumber) {
                map.set(id, value);
                continue;
              }
              // 在冲突位置上方改动 偏移
              if (startLineNumber < newStartLineNumber && endLineNumber < newEndLineNumber) {
                const newRange = new monaco.Range(
                  newStartLineNumber + offset,
                  1,
                  newEndLineNumber + offset,
                  newEndColumn,
                );
                map.set(id, {
                  ...value,
                  newRange,
                });
                continue;
              }
              // 包含冲突位置 删除
              if (startLineNumber <= newStartLineNumber && endLineNumber >= newEndLineNumber) {
                const newRangeOffset = newEndLineNumber - newStartLineNumber;
                if (offset <= newRangeOffset) {
                  continue;
                }
              }
              // 内部改动
              if (startLineNumber >= newStartLineNumber && endLineNumber <= newEndLineNumber) {
                // 内部改动删除
                // TODO
                // const newRange = new monaco.Range(newStartLineNumber, 1, newEndLineNumber + offset, 1);
                // map.set(id, {
                //   ...value,
                //   newRange,
                // });
              }
            }
            this.resetCacheResolvedConflicts(map);
          });
          this.updateAllWidgets();
          this.updateReportData();
        }),
        this.editor.onDidChangeModel(() => {
          this.updateAllWidgets();
          this.updateReportData();
        }),
      );
    }
  }

  private init() {
    this.initListenEvent();
  }

  /* report */
  get reportData() {
    const uri = this.getUri();
    const reportData = this.currentReportMap.get(uri);
    if (reportData) {
      return reportData;
    } else {
      const currentRelationId = this.mergeConflictReportService.startPoint();

      this.currentReportMap.set(uri, {
        conflictPointNum: 0,
        useAiConflictPointNum: 0,
        receiveNum: 0,
        clickNum: 0,
        isClickResolveAll: false,
        editorMode: 'traditional',
        relationId: currentRelationId,
      });
      this.uri2RelationId.set(uri, currentRelationId);
      return this.currentReportMap.get(uri)!;
    }
  }

  set reportData(data: Partial<IReportData>) {
    const uri = this.getUri();
    const reportData = this.reportData;
    this.currentReportMap.set(uri, {
      ...reportData,
      ...data,
    });
  }

  private reportConflictData() {
    const uri = this.getUri();
    const reportData = this.currentReportMap.get(uri);
    const currentRelationId = this.uri2RelationId.get(uri)!;
    if (reportData) {
      this.mergeConflictReportService.reportPoint(currentRelationId, this.reportData);
    }
  }

  private updateReportData() {
    const allConflictCache = this.cacheConflicts.getAllConflictsByUri(this.getUri());
    let conflictPointNum = 0;
    let useAiConflictPointNum = 0;
    let receiveNum = 0;
    conflictPointNum = allConflictCache?.length || 0;
    allConflictCache?.forEach((cacheConflict) => {
      if (cacheConflict.isResolved) {
        useAiConflictPointNum += 1;
      }
    });
    // 内部修改 删除态无法统计
    for (const [uri, cacheResolvedConflictsMap] of this.cacheResolvedConflicts.entries()) {
      for (const [, cacheResolvedConflicts] of cacheResolvedConflictsMap.entries()) {
        // 统计当前文件
        if (uri === this.getModel().uri.toString()) {
          // 计算当前文件采纳数量
          const aiResult = cacheResolvedConflicts.textChange.newText;
          const currentResult = this.getModel()?.getValueInRange(cacheResolvedConflicts.newRange);
          if (aiResult.trim() === currentResult.trim()) {
            cacheResolvedConflicts.isAccept = true;
            receiveNum += 1;
          } else {
            cacheResolvedConflicts.isAccept = false;
          }
        }
      }
    }
    this.reportData = {
      conflictPointNum,
      useAiConflictPointNum,
      receiveNum,
    };
  }

  /* report */
  getAllDiffRanges() {
    const rangeLines: IRange[] = [];
    for (const [, value] of this.getCacheResolvedConflicts().entries()) {
      rangeLines.push(value.newRange);
    }
    return rangeLines;
  }

  updateAllWidgets() {
    this.hideResolveResultWidget();
    for (const [id, value] of this.getCacheResolvedConflicts().entries()) {
      if (!value.isClosed) {
        const lineRange = this.toLineRange(value.newRange, id);
        this.resolveResultWidgetManager.addWidget(lineRange);
      }
    }
  }

  private getModel(): ITextModel {
    return this.editor.getModel()!;
  }

  private getUri(): string {
    return this.getModel().uri.toString();
  }

  /* cache widget */
  private getCacheResolvedConflicts(currentUri?: string) {
    if (!currentUri) {
      currentUri = this.getModel().uri.toString();
    }
    const cache = this.cacheResolvedConflicts.get(currentUri);
    if (cache) {
      return cache;
    } else {
      this.cacheResolvedConflicts.set(currentUri, new Map());
      return this.cacheResolvedConflicts.get(currentUri)!;
    }
  }

  private deleteCacheResolvedConflicts(id: string, currentUri?: string) {
    if (!currentUri) {
      currentUri = this.getModel().uri.toString();
    }

    const cache = this.cacheResolvedConflicts.get(currentUri);
    if (cache) {
      cache.delete(id);
    }
  }

  private setCacheResolvedConflict(id: string, cacheConflict: ICacheResolvedConflicts, currentUri?: string) {
    if (!currentUri) {
      currentUri = this.getModel().uri.toString();
    }
    const cache = this.getCacheResolvedConflicts(currentUri);
    cache.set(id, cacheConflict);
  }

  private resetCacheResolvedConflicts(cacheConflicts: Map<string, ICacheResolvedConflicts>, currentUri?: string) {
    if (!currentUri) {
      currentUri = this.getModel().uri.toString();
    }
    if (this.cacheResolvedConflicts.has(currentUri)) {
      this.cacheResolvedConflicts.set(currentUri, cacheConflicts);
    }
  }

  private toLineRange(range: IRange, id?: string) {
    const lineRange = new LineRange(range.startLineNumber, range.endLineNumber);
    if (id) {
      // @ts-ignore
      lineRange.setId(id);
    }
    return lineRange;
  }

  public renderSkeletonDecoration(range: LineRange, classNames: string[]) {
    const model = this.getModel();
    const renderSkeletonDecoration = (className: string): IModelDeltaDecoration => ({
      range: range.toRange(),
      options: {
        isWholeLine: true,
        description: 'skeleton',
        className,
      },
    });

    const preDecorationsIds =
      model?.deltaDecorations(
        [],
        classNames.map((cls) => renderSkeletonDecoration(cls)),
      ) || [];

    return () => {
      model!.deltaDecorations(preDecorationsIds, []);
    };
  }

  registerCommands(commands: CommandRegistry): void {
    this.disposables.push(
      commands.registerCommand(MERGE_CONFLICT.AI_ACCEPT, {
        execute: async (type: CommitType, conflict: DocumentMergeConflict) => {
          this.reportData = {
            clickNum: this.reportData.clickNum! + 1,
          };
          this.conflictAIAccept(conflict);
        },
      }),
      commands.registerCommand(MERGE_CONFLICT.ALL_RESET, {
        execute: async (uri: Uri) => {
          const content = this.cacheConflicts.getConflictText(uri.toString());
          this.cancelRequestToken();
          if (content) {
            if (this.editorService.currentEditor?.currentUri?.toString() === uri.toString()) {
              const editor = this.editorService.currentEditor?.monacoEditor;
              if (editor) {
                const model = editor.getModel();
                model?.setValue(content);
                this.cacheConflicts.deleteConflictText(uri.toString());
                this.cleanAllCache();
              }
            }
          }
        },
      }),

      commands.registerCommand(MERGE_CONFLICT.AI_ALL_ACCEPT, {
        execute: async () => {
          const document = this.getModel();
          if (!document) {
            return Promise.resolve();
          }
          this.reportData = {
            isClickResolveAll: true,
          };
          //  一个个解决
          await this.acceptAllConflict();
        },
      }),
      commands.registerCommand(MERGE_CONFLICT.AI_ALL_ACCEPT_STOP, {
        execute: async () => {
          this.cancelRequestToken();
        },
      }),
      commands.afterExecuteCommand('git.stage', (args) => {
        this.reportConflictData();
        return args;
      }),
      commands.afterExecuteCommand('git.stageAllMerge', (args) => {
        this.reportConflictData();
        return args;
      }),
    );
  }

  onDidStart(): MaybePromise<void> {
    if (this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      this.disposables.push(
        this.eventBus.on(ExtensionActivatedEvent, (e) => {
          // 当插件注册完毕 再初始化 codelens 使其位置正确
          if (
            e.payload.topic === 'onExtensionActivated' &&
            (e.payload.data?.id as string).endsWith('.merge-conflict')
          ) {
            if (this.aiNativeConfigService.capabilities.supportsConflictResolve) {
              this.registerCodeLensProvider();
              loadStyleString(true);
            }
          }
        }),
        // TODO 优化使用 registerEditorFeature
        this.editorService.onActiveResourceChange(() => {
          this.contribute(this.editorService.currentEditor!);
        }),
      );
    } else {
      loadStyleString(false);
    }
  }

  private contribute(editor: IEditor) {
    if (!editor) {
      return this;
    }

    const { monacoEditor, currentUri } = editor;
    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return this;
    }
    const currentEditor = editor;
    if (currentEditor && monacoEditor && !this.editor) {
      this.editor = monacoEditor;
      this.resolveResultWidgetManager = new WidgetFactory(
        ResolveResultWidget,
        this as unknown as ResultCodeEditor,
        this.injector,
      );
      this.stopWidgetManager = new WidgetFactory(StopWidget, this as unknown as ResultCodeEditor, this.injector);
      this.init();
    }
  }

  async provideCodeLens(
    document: monaco.editor.ITextModel,
    _token: monaco.CancellationToken,
  ): Promise<monaco.languages.CodeLens[] | null> {
    const conflicts = this.cacheConflicts.scanDocument(document);
    if (!conflicts?.length) {
      return null;
    }
    const items: monaco.languages.CodeLens[] = [];
    conflicts.forEach((conflict) => {
      const aiAcceptCommand = {
        id: MERGE_CONFLICT.AI_ACCEPT.id,
        title: `$(ai-magic) ${localize('mergeEditor.conflict.resolve.all')}`,
        arguments: ['know-conflict', conflict],
        tooltip: localize('mergeEditor.conflict.resolve.all'),
      };
      // loading 效果
      this.loadingRange.forEach((range) => {
        if (conflict.range.equalsRange(range)) {
          aiAcceptCommand.title = `$(loading~spin) ${localize('mergeEditor.conflict.resolve.all')}`;
        }
      });
      items.push({
        range: conflict.range,
        command: aiAcceptCommand,
        id: MERGE_CONFLICT.AI_ACCEPT.id,
      });
    });

    return Promise.resolve(items);
  }

  private async conflictAIAccept(conflict?: DocumentMergeConflict, lineRan?: LineRange, isRegenerate?: boolean) {
    if (!this.editorService.currentEditor?.monacoEditor) {
      return;
    }
    let lineRange: LineRange;
    if (conflict) {
      lineRange = this.toLineRange(conflict.range);
    } else {
      lineRange = lineRan!;
    }
    const range = lineRange.toRange(1, conflict?.range.endColumn ?? Constants.MAX_SAFE_SMALL_INTEGER);
    const skeletonDecorationDispose = this.renderSkeletonDecoration(lineRange, [
      styles.skeleton_decoration,
      styles.skeleton_decoration_background_black,
    ]);
    this.stopWidgetManager.addWidget(lineRange);

    let codeAssemble = this.getModel()?.getValueInRange(lineRange.toRange()) ?? '';
    if (isRegenerate) {
      codeAssemble = this.getCacheResolvedConflicts().get(lineRange.id)?.conflictText ?? '';
    }

    let resolveConflictResult: IAiBackServiceResponse | undefined;
    try {
      this.loadingRange.add(range);
      resolveConflictResult = await this.requestAiResolveConflict(codeAssemble, lineRange, isRegenerate);
    } catch (error) {
      throw new Error(`AI resolve conflict error: ${error.toString()}`);
    } finally {
      skeletonDecorationDispose();
      this.stopWidgetManager.hideWidget(lineRange.id);
      this.loadingRange.delete(range);
      this.updateCodeLensProvider();
    }

    if (resolveConflictResult && resolveConflictResult.data) {
      const { text, lineNumber, lines } = this.resolveEndLineEOL(resolveConflictResult.data);
      const endLineNumber = lineRange.startLineNumber + lineNumber - 1;
      const endColumn = lines[lines.length - 1].length + 1;
      const newRange = new monaco.Range(lineRange.startLineNumber, 1, endLineNumber, endColumn);
      const edit = {
        range,
        text,
      };
      let validEditOperation: IValidEditOperation[] = [];
      this.getModel()?.pushEditOperations(null, [edit], (operation) => {
        validEditOperation = operation;
        const selections: monaco.Selection[] = [];
        operation.forEach((op) => {
          selections.push(
            new monaco.Selection(
              op.range.startLineNumber,
              op.range.startColumn,
              op.range.endLineNumber,
              op.range.endColumn,
            ),
          );
        });
        // 自动选中
        // this.editor.setSelections(selections);
        return selections;
      });
      const newLineRange = this.toLineRange(newRange, lineRange?.id);
      this.resolveResultWidgetManager.addWidget(newLineRange);
      // 记录每一次解决的位置
      const oldCacheConflict = this.getCacheResolvedConflicts().get(newLineRange.id);
      this.setCacheResolvedConflict(newLineRange.id, {
        ...validEditOperation[0],
        newRange,
        id: newLineRange.id,
        // 保留原始冲突文本
        conflictText: oldCacheConflict?.conflictText || validEditOperation[0].text,
        isAccept: true,
      });
      this.updateReportData();
      this.reportConflictData();
      if (!isRegenerate) {
        // 记录处理数量 非重新生成 conflict 存在
        const uri = this.getModel().uri.toString();
        const cacheConflictRanges = this.cacheConflicts.getAllConflictsByUri(uri);
        if (cacheConflictRanges) {
          const cacheConflict = cacheConflictRanges.find((cacheConflict) =>
            cacheConflict.range.equalsRange(conflict!.range),
          );
          // TODO 同步 scanDocument
          if (cacheConflict && !cacheConflict.isResolved) {
            this.cacheConflicts.setConflictResolved(uri, cacheConflict.id);
          }
        }
      } else {
        this.reportData = {
          clickNum: this.reportData.clickNum! + 1,
        };
      }
    } else {
      if (resolveConflictResult?.errorCode !== 0 && !resolveConflictResult?.isCancel) {
        this.debounceMessageWarning();
        this.loadingRange.delete(range);
      }
    }
  }

  private resolveEndLineEOL(text: string): { text: string; lineNumber: number; lines: string[] } {
    const eol = this.getModel()?.getEOL() ?? '\n';
    const lines = text.split(eol);
    const lastLine = lines[lines.length - 1];
    // 最后一行去掉换行符
    if (lastLine === '' && lines.length > 1) {
      lines.pop();
    }
    return {
      text: lines.join(eol),
      lineNumber: lines.length,
      lines,
    };
  }

  private async acceptAllConflict() {
    const document = this.getModel() as monaco.editor.ITextModel;
    if (!document) {
      return Promise.resolve();
    }
    const conflicts = this.cacheConflicts.scanDocument(document);
    if (!conflicts?.length) {
      return Promise.resolve();
    }
    let isCancelAll = false;
    // TODO 优化
    this.disposables.push(
      this.onRequestsCancel(() => {
        isCancelAll = true;
        return;
      }),
    );
    return this.conflictAIAccept(conflicts[0]).then(() => {
      if (isCancelAll) {
        return Promise.resolve();
      }
      if (!conflicts?.length) {
        this.debounceMessageSuccess();
      }
      return this.acceptAllConflict();
    });
  }

  private registerCodeLensProvider() {
    return monaco.languages.registerCodeLensProvider([{ scheme: 'file' }], {
      provideCodeLenses: async (model, token) => {
        let lens = await this.provideCodeLens(model, token);
        return {
          lenses: lens ?? [],
          dispose: () => {
            lens = [];
          },
        };
      },
    });
  }

  private async requestAiResolveConflict(
    codePromptBean: string,
    range: LineRange,
    isRegenerate = false,
  ): Promise<IAiBackServiceResponse | undefined> {
    if (this.aiBackService) {
      let prompt = `你是一个智能解决代码冲突的专家，我遇到了一个代码的冲突，请仔细思考后给我解决冲突后最匹配的一个结果。注意，你需要理解代码语义后再给出答案。以下是代码中的冲突部分: \n ${codePromptBean}`;

      if (isRegenerate) {
        const newContent = this.getModel()!.getValueInRange(range.toRange());
        prompt += `\n当前的解决冲突后的代码是 \n ${newContent}，但是我不够满意，希望给出另一种解决方案`;
      }
      return this.aiBackService.request(prompt, { type: 'resolveConflict' }, this.createRequestToken(range.id).token);
    }
    return;
  }

  // 生成 cancel token
  public createRequestToken(id: string): CancellationTokenSource {
    const token = new CancellationTokenSource();
    this.cancelIndicatorMap.set(id, token);
    return token;
  }

  public hideResolveResultWidget(id?: string) {
    this.resolveResultWidgetManager.hideWidget(id);
  }

  public hideStopWidget(id?: string) {
    this.stopWidgetManager.hideWidget(id);
  }

  public cancelRequestToken(id?: string) {
    if (id) {
      if (!this.cancelIndicatorMap.has(id)) {
        return;
      }
      const token = this.cancelIndicatorMap.get(id);
      token?.cancel();
      this._onRequestCancel.fire({ id, type: 'cancel' });
      return;
    }
    const requestsCancel: IRequestCancel[] = [];

    this.cancelIndicatorMap.forEach((token, id) => {
      token.cancel();
      requestsCancel.push({ id, type: 'cancel' });
    });
    this._onRequestsCancel.fire(requestsCancel);
    this.cancelIndicatorMap.clear();
  }

  public launchConflictActionsEvent(eventData: Omit<IConflictActionsEvent, 'withViewType'>): void {
    const { range, action } = eventData;
    if (action === REVOKE_ACTIONS) {
      const cacheConflict = this.getCacheResolvedConflicts().get(range.id);
      if (cacheConflict) {
        const edit = {
          range: cacheConflict.newRange,
          text: cacheConflict.conflictText || cacheConflict.text,
        };
        this.getModel()?.pushEditOperations(null, [edit], () => null);
      }
      this.cleanWidget(range.id);
      this.deleteCacheResolvedConflicts(range.id);
    } else if (action === AI_RESOLVE_REGENERATE_ACTIONS) {
      this.cleanWidget(range.id);
      this.conflictAIAccept(undefined, range, true);
    } else if (action === IGNORE_ACTIONS) {
      this.cleanWidget(range.id);
      // this.deleteCacheResolvedConflicts(range.id);
      const resolvedConflict = this.getCacheResolvedConflicts().get(range.id)!;
      this.setCacheResolvedConflict(range.id, {
        ...resolvedConflict,
        isClosed: true,
      });
    }
  }

  private cleanAllCache() {
    this.hideStopWidget();
    this.hideResolveResultWidget();
    this.getCacheResolvedConflicts().clear();
  }

  private cleanWidget(id: string) {
    if (id) {
      this.hideStopWidget(id);
      this.hideResolveResultWidget(id);
      return;
    }
    this.hideStopWidget();
    this.hideResolveResultWidget();
  }

  // 强制刷新 codelens
  private updateCodeLensProvider() {
    setTimeout(() => {
      if (this.getModel().uri) {
        // @ts-ignore
        languageFeaturesService.codeLensProvider._onDidChange.fire();
      }
    }, 2000);
  }

  private debounceMessageWarning = debounce(() => {
    message.warning('未解决此次冲突，AI 暂无法处理本文件的冲突，需人工处理。');
  }, 1000);

  private debounceMessageSuccess = debounce(() => {
    message.warning('生成成功， AI 已完成冲突的处理');
  }, 1000);
}
