import debounce from 'lodash/debounce';

import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { message } from '@opensumi/ide-components';
import { AiNativeConfigService, ClientAppContribution } from '@opensumi/ide-core-browser';
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
} from '@opensumi/ide-core-common';
import { AiBackSerivcePath, IAiBackService, IAiBackServiceResponse } from '@opensumi/ide-core-common/lib/ai-native';
import {
  BrowserEditorContribution,
  IEditor,
  IEditorFeatureRegistry,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { BaseInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/content-widget';
import { LineRange } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/model/line-range';
import {
  AI_RESOLVE_REGENERATE_ACTIONS,
  IConflictActionsEvent,
  REVOKE_ACTIONS,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/types';
import { ResultCodeEditor } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/view/editors/resultCodeEditor';
import styles from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/view/merge-editor.module.less';
import { ResolveResultWidget } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/widget/resolve-result-widget';
import { StopWidget } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/widget/stop-widget';
import { ICodeEditor, IModelDeltaDecoration } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import { IValidEditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { CacheConflict, DocumentMergeConflict } from './cacheConflicts';
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

// 内置 MergeConflict 插件 以支持AI交互
@Domain(BrowserEditorContribution, CommandContribution, ClientAppContribution)
export class MergeConflictContribution
  extends Disposable
  implements BrowserEditorContribution, CommandContribution, ClientAppContribution
{
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
  public aiBackService: IAiBackService;

  private resolveResultWidgetManager: IWidgetFactory;
  private cancelIndicatorMap: Map<string, CancellationTokenSource> = new Map();
  private stopWidgetManager: IWidgetFactory;
  private cacheResolvedConflicts: Map<string, ICacheResolvedConflicts> = new Map();

  private editor: ICodeEditor;
  constructor() {
    super();
  }

  private initListenEvent(): void {
    this.addDispose(
      this.editor.onDidChangeModel(() => {
        this.hideResolveResultWidget();
      }),
    );

    if (this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      this.addDispose(
        this.editor.onMouseMove(
          debounce((event: monaco.editor.IEditorMouseEvent) => {
            const { target } = event;
            if (target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS) {
              this.hideResolveResultWidget();
              return;
            }
            const mousePosition = target.position;
            if (!mousePosition) {
              return;
            }

            const allRanges = this.getAllDiffRanges();
            const toLineRange = LineRange.fromPositions(mousePosition.lineNumber);

            const isTouches = allRanges.some((range) => range.isTouches(toLineRange));
            if (isTouches) {
              const targetInRange = allRanges.find((range) => range.isTouches(toLineRange));
              if (!targetInRange) {
                return;
              }
              this.resolveResultWidgetManager.addWidget(targetInRange);
            } else {
              this.hideResolveResultWidget();
            }
          }, 10),
        ),
      );
    }
  }
  getAllDiffRanges() {
    const rangeLines: LineRange[] = [];
    for (const [key, value] of this.cacheResolvedConflicts.entries()) {
      rangeLines.push(this.toLineRange(value.newRange));
    }
    return rangeLines;
  }

  private getModel() {
    return this.editorService.currentEditor?.monacoEditor?.getModel();
  }

  private toLineRange(range: IRange) {
    return new LineRange(range.startLineNumber, range.endLineNumber);
  }

  public renderSkeletonDecoration(range: LineRange, classNames: string[]) {
    const model = this.editorService.currentEditor?.monacoEditor?.getModel();

    const renderSkeletonDecoration = (className: string): IModelDeltaDecoration => ({
      range: monaco.Range.fromPositions(
        new Position(range.startLineNumber, 1),
        new Position(Math.max(range.startLineNumber, range.endLineNumberExclusive - 1), 1),
      ),
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
          this.conflictAIAccept(conflict);
        },
      }),
      commands.registerCommand(MERGE_CONFLICT.ALL_RESET, {
        execute: async (uri: Uri) => {
          const content = this.cacheConflicts.getConflict(uri.toString());
          if (content) {
            if (this.editorService.currentEditor?.currentUri?.toString() === uri.toString()) {
              const editor = this.editorService.currentEditor?.monacoEditor;
              if (editor) {
                const model = editor.getModel();
                model?.setValue(content);
                this.cacheConflicts.deleteConflict(uri.toString());
                this.hideResolveResultWidget();
                this.hideStopWidget();
                this.cacheResolvedConflicts.clear();
              }
            }
          }
        },
      }),

      commands.registerCommand(MERGE_CONFLICT.AI_ALL_ACCEPT, {
        execute: async () => {
          const document = this.getModel() as monaco.editor.ITextModel;
          if (!document) {
            return;
          }
          // 上一个位置影响下一个冲突位置 只能一个个解决
          await this.acceptAllConflict();
        },
      }),
      commands.registerCommand(MERGE_CONFLICT.AI_ALL_ACCEPT_STOP, {
        execute: async () => {
          this.cancelRequestToken();
        },
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
      );
    } else {
      loadStyleString(false);
    }
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        const disposer = new Disposable();
        const { monacoEditor, currentUri } = editor;
        if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
          return disposer;
        }
        const currentEditor = editor;
        if (currentEditor && monacoEditor) {
          this.editor = monacoEditor;
          this.resolveResultWidgetManager = new WidgetFactory(
            ResolveResultWidget,
            this as unknown as ResultCodeEditor,
            this.injector,
          );
          this.stopWidgetManager = new WidgetFactory(StopWidget, this as unknown as ResultCodeEditor, this.injector);

          this.initListenEvent();
        }
        return disposer;
      },
    });
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
        id: 'merge-conflict.ai.accept',
        title: '$(ai-magic) AI 一键解决',
        arguments: ['know-conflict', conflict],
        tooltip: localize('mergeEditor.conflict.resolve.all'),
      };

      items.push({
        range: conflict.range,
        command: aiAcceptCommand,
        id: 'merge-conflict.ai.accept',
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
    const range = lineRange.toRange();

    const skeletonDecorationDispose = this.renderSkeletonDecoration(lineRange, [
      styles.skeleton_decoration,
      styles.skeleton_decoration_background,
    ]);
    this.stopWidgetManager.addWidget(lineRange);

    let codeAssemble = this.getModel()?.getValueInRange(lineRange.toRange()) ?? '';
    if (isRegenerate) {
      codeAssemble = this.cacheResolvedConflicts.get(lineRange.id)?.textChange.oldText ?? '';
    }

    let resolveConflictResult: IAiBackServiceResponse | undefined;
    try {
      resolveConflictResult = await this.requestAiResolveConflict(codeAssemble, lineRange, isRegenerate);
    } catch (error) {
      throw new Error(`AI resolve conflict error: ${error}`);
    } finally {
      skeletonDecorationDispose();
      this.stopWidgetManager.hideWidget(lineRange.id);
    }

    if (resolveConflictResult && resolveConflictResult.data) {
      const resultLines = resolveConflictResult.data.split('\n');
      const lastLens = resultLines[resultLines.length - 1];

      const newRange = new monaco.Range(
        lineRange.startLineNumber,
        1,
        lineRange.startLineNumber + resultLines.length - 1,
        lastLens.length,
      );
      const edit = {
        range,
        text: resolveConflictResult.data,
      };
      const validEditOperation = this.getModel()?.applyEdits([edit], true) || [];
      const newLineRange = this.toLineRange(newRange);
      this.resolveResultWidgetManager.addWidget(newLineRange);
      this.cacheResolvedConflicts.set(newLineRange.id, {
        ...validEditOperation[0],
        newRange,
      });
    } else {
      if (resolveConflictResult?.errorCode !== 0 && !resolveConflictResult?.isCancel) {
        this.debounceMessageWarning();
      }
    }
  }

  private async acceptAllConflict() {
    // 每一次改动range 都会变化 需要一次次 scanDocument
    const document = this.getModel() as monaco.editor.ITextModel;
    if (!document) {
      return Promise.resolve();
    }
    const conflicts = this.cacheConflicts.scanDocument(document);
    if (!conflicts?.length) {
      return Promise.resolve();
    }
    await this.conflictAIAccept(conflicts[0]);
    return this.acceptAllConflict();
  }

  private registerCodeLensProvider() {
    return monaco.languages.registerCodeLensProvider([{ scheme: 'file' }], {
      provideCodeLenses: async (model, token) => {
        const lens = await this.provideCodeLens(model, token);
        return {
          lenses: lens ?? [],
          dispose: () => this.disposables,
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
    if (id) {
      this.cacheResolvedConflicts.delete(id);
    }
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
      return;
    }

    this.cancelIndicatorMap.forEach((token) => {
      token.cancel();
    });
    this.cancelIndicatorMap.clear();
  }

  public launchConflictActionsEvent(eventData: Omit<IConflictActionsEvent, 'withViewType'>): void {
    const { range, action } = eventData;
    if (action === REVOKE_ACTIONS) {
      this.hideResolveResultWidget(range.id);
      this.hideStopWidget(range.id);

      const cache = this.cacheResolvedConflicts.get(range.id);

      if (cache) {
        const edit = {
          range: cache.newRange,
          text: cache.text,
        };
        this.getModel()?.applyEdits([edit], true);
      }
    } else if (action === AI_RESOLVE_REGENERATE_ACTIONS) {
      this.hideResolveResultWidget(range.id);
      this.hideStopWidget(range.id);
      this.cacheResolvedConflicts.delete(range.id);
      this.conflictAIAccept(undefined, range, true);
    }
  }

  private debounceMessageWarning = debounce(() => {
    message.warning('未解决此次冲突，AI 暂无法处理本文件的冲突，需人工处理。');
  }, 1000);
}
