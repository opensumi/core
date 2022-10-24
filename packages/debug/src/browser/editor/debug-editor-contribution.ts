import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  IContextKeyService,
  PreferenceService,
  MonacoOverrideServiceRegistry,
  ServiceNames,
  Position,
  positionToRange,
} from '@opensumi/ide-core-browser';
import {
  IDisposable,
  Disposable,
  RunOnceScheduler,
  CancellationTokenSource,
  onUnexpectedExternalError,
  createMemoizer,
  Event,
  arrays,
  Constants,
  strings,
} from '@opensumi/ide-core-browser';
import { IEditor, IDecorationApplyOptions } from '@opensumi/ide-editor';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { MonacoCodeService } from '@opensumi/ide-editor/lib/browser/editor.override';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { StandardTokenType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/encodedTokenAttributes';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { DebugContextKey } from '../contextkeys/debug-contextkey.service';
import { DebugExceptionWidget } from '../debug-exception-widget';
import { DebugSession } from '../debug-session';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugStackFrame } from '../model';
import { DebugVariable, DebugWatchNode, DebugWatchRoot } from '../tree';

import { DebugState, IDebugExceptionInfo, IDebugSession, IDebugSessionManager } from './../../common';
import { InlineValueContext } from './../../common/inline-values';
import { DEFAULT_WORD_REGEXP } from './../debugUtils';
import { DebugModelManager } from './debug-model-manager';

const INLINE_VALUE_DECORATION_KEY = 'inlinevaluedecoration';
const MAX_NUM_INLINE_VALUES = 100;
const MAX_INLINE_DECORATOR_LENGTH = 150; // 调试时每个内联修饰符的最大字符串长度。超过这个值就在后面显示 ...
const MAX_TOKENIZATION_LINE_LEN = 500; // 如果这行太长了，则跳过该行的内联值

const { flatten } = arrays;

class InlineSegment {
  constructor(public column: number, public text: string) {}
}

function createInlineValueDecoration(
  lineNumber: number,
  contentText: string,
  column = Constants.MAX_SAFE_SMALL_INTEGER,
): IDecorationApplyOptions {
  if (contentText.length > MAX_INLINE_DECORATOR_LENGTH) {
    contentText = contentText.substr(0, MAX_INLINE_DECORATOR_LENGTH) + '...';
  }

  return {
    range: {
      startLineNumber: lineNumber,
      endLineNumber: lineNumber,
      startColumn: column,
      endColumn: column,
    },
    renderOptions: {
      after: {
        contentText,
        backgroundColor: 'rgba(255, 200, 0, 0.2)',
        margin: '10px',
      },
      dark: {
        after: {
          color: 'rgba(255, 255, 255, 0.5)',
        },
      },
      light: {
        after: {
          color: 'rgba(0, 0, 0, 0.5)',
        },
      },
    },
  };
}

function createInlineValueDecorationsInsideRange(
  expressions: ReadonlyArray<DebugVariable>,
  range: Range,
  model: ITextModel,
  wordToLineNumbersMap: Map<string, number[]>,
): IDecorationApplyOptions[] {
  const nameValueMap = new Map<string, string>();
  for (const expr of expressions) {
    nameValueMap.set(expr.name, expr.value);
    if (nameValueMap.size >= MAX_NUM_INLINE_VALUES) {
      break;
    }
  }

  const lineToNamesMap: Map<number, string[]> = new Map<number, string[]>();

  nameValueMap.forEach((_value, name) => {
    const lineNumbers = wordToLineNumbersMap.get(name);
    if (lineNumbers) {
      for (const lineNumber of lineNumbers) {
        if (range.containsPosition(new Position(lineNumber, 0))) {
          if (!lineToNamesMap.has(lineNumber)) {
            lineToNamesMap.set(lineNumber, []);
          }

          if (lineToNamesMap.get(lineNumber)!.indexOf(name) === -1) {
            lineToNamesMap.get(lineNumber)!.push(name);
          }
        }
      }
    }
  });

  const decorations: IDecorationApplyOptions[] = [];

  lineToNamesMap.forEach((names, line) => {
    const contentText = names
      .sort((first, second) => {
        const content = model.getLineContent(line);
        return content.indexOf(first) - content.indexOf(second);
      })
      .map((name) => `${name} = ${nameValueMap.get(name)}`)
      .join(', ');
    decorations.push(createInlineValueDecoration(line, contentText));
  });

  return decorations;
}

function getWordToLineNumbersMap(model: ITextModel | null): Map<string, number[]> {
  const result = new Map<string, number[]>();
  if (!model) {
    return result;
  }

  for (let lineNumber = 1, len = model.getLineCount(); lineNumber <= len; ++lineNumber) {
    const lineContent = model.getLineContent(lineNumber);

    if (lineContent.length > MAX_TOKENIZATION_LINE_LEN) {
      continue;
    }

    model.tokenization.forceTokenization(lineNumber);
    const lineTokens = model.tokenization.getLineTokens(lineNumber);
    for (let tokenIndex = 0, tokenCount = lineTokens.getCount(); tokenIndex < tokenCount; tokenIndex++) {
      const tokenType = lineTokens.getStandardTokenType(tokenIndex);

      if (tokenType === StandardTokenType.Other) {
        DEFAULT_WORD_REGEXP.lastIndex = 0;

        const tokenStartOffset = lineTokens.getStartOffset(tokenIndex);
        const tokenEndOffset = lineTokens.getEndOffset(tokenIndex);
        const tokenStr = lineContent.substring(tokenStartOffset, tokenEndOffset);
        const wordMatch = DEFAULT_WORD_REGEXP.exec(tokenStr);

        if (wordMatch) {
          const word = wordMatch[0];
          if (!result.has(word)) {
            result.set(word, []);
          }

          result.get(word)!.push(lineNumber);
        }
      }
    }
  }

  return result;
}

@Injectable({ multiple: true })
export class DebugEditorContribution implements IEditorFeatureContribution {
  private static readonly MEMOIZER = createMemoizer();

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(DebugModelManager)
  protected readonly debugModelManager: DebugModelManager;

  @Autowired(IDebugSessionManager)
  protected readonly debugSessionManager: DebugSessionManager;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServicesRegistry: MonacoOverrideServiceRegistry;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(DebugContextKey)
  protected readonly debugContextKey: DebugContextKey;

  private readonly disposer: Disposable = new Disposable();
  private readonly editorDisposer: Disposable = new Disposable();

  private debugExceptionWidget: DebugExceptionWidget | undefined;

  constructor() {}

  public contribute(editor: IEditor): IDisposable {
    this.disposer.addDispose(
      this.debugSessionManager.onDidChangeActiveDebugSession(() => {
        const currentSession = this.debugSessionManager.currentSession;
        if (currentSession) {
          this.editorDisposer.addDispose(
            currentSession.onDidChange(async () => {
              this.setHoverEnabled(editor, currentSession.state === DebugState.Running);

              const currentFrame = currentSession.currentThread?.currentFrame;
              if (!currentFrame) {
                return;
              }

              if (currentFrame.source?.uri.isEqual(editor.currentUri!)) {
                await this.toggleExceptionWidget();
              } else {
                this.closeExceptionWidget();
              }
            }),
          );

          this.editorDisposer.addDispose(
            currentSession.onDidExitAdapter(() => {
              this.setHoverEnabled(editor, true);
            }),
          );

          this.editorDisposer.addDispose(
            this.editorService.onActiveResourceChange((resource) => {
              if (resource?.uri.toString() === currentSession.getModel()?.uri.toString()) {
                this.setHoverEnabled(editor);
              } else {
                this.setHoverEnabled(editor, true);
              }
            }),
          );

          this.disposer.addDispose([
            Event.any<void | DebugProtocol.StoppedEvent>(
              currentSession.onDidChangeCallStack,
              currentSession.onDidStop,
            )(async () => {
              await this.directRunUpdateInlineValueDecorations(editor);
            }),

            currentSession.onDidExitAdapter(() => {
              this.removeInlineValuesScheduler(editor).schedule();
              this.editorDisposer.dispose();
            }),
          ]);

          this.disposer.addDispose(
            currentSession.onDidChangeState((state: DebugState) => {
              if (state !== DebugState.Stopped) {
                this.toggleExceptionWidget();
              }
            }),
          );

          this.disposer.addDispose(currentSession);

          this.registerEditorListener(editor);
        }
      }),
    );

    this.disposer.addDispose(this.editorDisposer);

    this.toggleExceptionWidget();
    return this.disposer;
  }

  private registerEditorListener(editor: IEditor): void {
    this.editorDisposer.addDispose(
      editor.monacoEditor.onKeyDown(async (keydownEvent: monaco.IKeyboardEvent) => {
        // 如果当前 session 会话的 editor 和当前打开的 editor 不一致，则不作处理
        if (
          this.debugSessionManager.currentSession?.currentFrame?.source?.uri.toString() !==
          editor.currentUri?.toString()
        ) {
          return;
        }

        if (keydownEvent.keyCode === monaco.KeyCode.Alt) {
          this.setHoverEnabled(editor, true);
          this.debugModelManager.model?.getDebugHoverWidget().hide();
          const listener = editor.monacoEditor.onKeyUp(async (keyupEvent: monaco.IKeyboardEvent) => {
            if (keyupEvent.keyCode === monaco.KeyCode.Alt) {
              this.setHoverEnabled(editor, false);
              this.debugModelManager.model?.getDebugHoverWidget().show();
              listener.dispose();
            }
          });
        }
      }),
    );

    this.editorDisposer.addDispose(
      editor.monacoEditor.onDidChangeModelContent(async () => {
        DebugEditorContribution.MEMOIZER.clear();
        await this.directRunUpdateInlineValueDecorations(editor);
      }),
    );

    this.editorDisposer.addDispose(
      editor.monacoEditor.onDidChangeModel(async () => {
        this.toggleExceptionWidget();
        await this.directRunUpdateInlineValueDecorations(editor);
      }),
    );
  }

  public registerDecorationType(): void {
    const codeEditorService = this.overrideServicesRegistry.getRegisteredService(
      ServiceNames.CODE_EDITOR_SERVICE,
    ) as MonacoCodeService;
    codeEditorService.registerDecorationType('inline-value-decoration', INLINE_VALUE_DECORATION_KEY, {});
  }

  public setHoverEnabled(editor: IEditor, isEnabled = !this.debugContextKey.contextInDdebugMode.get()) {
    editor.monacoEditor.updateOptions({
      hover: {
        enabled: isEnabled,
      },
    });
  }

  private async directRunUpdateInlineValueDecorations(editor: IEditor): Promise<void> {
    const stackFrame = this.debugSessionManager.currentSession?.currentFrame;
    if (stackFrame) {
      DebugEditorContribution.MEMOIZER.clear();
      await this.updateInlineValueDecorations(stackFrame, editor);
    }
  }

  private removeInlineValuesScheduler(editor: IEditor): RunOnceScheduler {
    return new RunOnceScheduler(() => editor.monacoEditor.removeDecorationsByType(INLINE_VALUE_DECORATION_KEY), 100);
  }

  private async updateInlineValueDecorations(stackFrame: DebugStackFrame | undefined, editor: IEditor): Promise<void> {
    if (!editor) {
      return;
    }

    const varValueFormat = '{0} = {1}';
    const separator = ', ';

    const model = editor.monacoEditor.getModel();
    if (
      !this.preferenceService.get('debug.inline.values') ||
      !model ||
      !stackFrame ||
      model.uri.toString() !== stackFrame.source?.uri.toString()
    ) {
      if (!this.removeInlineValuesScheduler(editor).isScheduled()) {
        this.removeInlineValuesScheduler(editor).schedule();
      }
      return;
    }

    this.removeInlineValuesScheduler(editor).cancel();

    let allDecorations: IDecorationApplyOptions[];

    if (languageFeaturesService.inlineValuesProvider.has(model)) {
      const findVariable = async (_key: string, caseSensitiveLookup: boolean): Promise<string | undefined> => {
        const scopes = await stackFrame.getMostSpecificScopes(stackFrame.range());
        const key = caseSensitiveLookup ? _key : _key.toLowerCase();
        for (const scope of scopes) {
          await scope.ensureLoaded();
          const variables = (scope.children as DebugVariable[]) || [];
          const found = variables.find((v) => (caseSensitiveLookup ? v.name === key : v.name.toLowerCase() === key));
          if (found) {
            return found.value;
          }
        }
        return undefined;
      };

      const ctx: InlineValueContext = {
        frameId: stackFrame.raw.id,
        stoppedLocation: (() => {
          const sr = stackFrame.range();
          return new Range(sr.startLineNumber, sr.startColumn + 1, sr.endLineNumber, sr.endColumn + 1);
        })(),
      };
      const token = new CancellationTokenSource().token;

      const ranges = editor.monacoEditor.getVisibleRanges();
      const providers = languageFeaturesService.inlineValuesProvider.ordered(model).reverse();

      allDecorations = [];
      const lineDecorations = new Map<number, InlineSegment[]>();

      const promises = flatten(
        providers.map((provider) =>
          ranges.map((range) =>
            Promise.resolve(provider.provideInlineValues(model, range, ctx, token)).then(
              async (result) => {
                if (result) {
                  for (const iv of result) {
                    let text: string | undefined;
                    switch (iv.type) {
                      case 'text':
                        text = iv.text;
                        break;
                      case 'variable': {
                        let va = iv.variableName;
                        if (!va) {
                          const lineContent = model.getLineContent(iv.range.startLineNumber);
                          va = lineContent.substring(iv.range.startColumn - 1, iv.range.endColumn - 1);
                        }
                        const value = await findVariable(va, iv.caseSensitiveLookup);
                        if (value) {
                          text = strings.format(varValueFormat, va, value);
                        }
                        break;
                      }
                      case 'expression': {
                        let expr = iv.expression;
                        if (!expr) {
                          const lineContent = model.getLineContent(iv.range.startLineNumber);
                          expr = lineContent.substring(iv.range.startColumn - 1, iv.range.endColumn - 1);
                        }
                        if (expr) {
                          const root = new DebugWatchRoot(stackFrame.thread.session);
                          const expression = new DebugWatchNode(stackFrame.thread.session, expr, root);
                          await expression.evaluate(expr);
                          if (expression.available) {
                            text = strings.format(varValueFormat, expr, expression.description);
                          }
                        }
                        break;
                      }
                    }

                    if (text) {
                      const line = iv.range.startLineNumber;
                      let lineSegments = lineDecorations.get(line);
                      if (!lineSegments) {
                        lineSegments = [];
                        lineDecorations.set(line, lineSegments);
                      }
                      if (!lineSegments.some((iv) => iv.text === text)) {
                        // de-dupe
                        lineSegments.push(new InlineSegment(iv.range.startColumn, text));
                      }
                    }
                  }
                }
              },
              (err) => {
                onUnexpectedExternalError(err);
              },
            ),
          ),
        ),
      );

      await Promise.all(promises);

      lineDecorations.forEach((segments, line) => {
        if (segments.length > 0) {
          segments = segments.sort((a, b) => a.column - b.column);
          const text = segments.map((s) => s.text).join(separator);
          allDecorations.push(createInlineValueDecoration(line, text));
        }
      });
    } else {
      const scopes = await stackFrame.getMostSpecificScopes(stackFrame.range());
      // 获取 scope 链中的所有顶级变量
      const decorationsPerScope = await Promise.all(
        scopes.map(async (scope) => {
          await scope.ensureLoaded();
          const variables = scope.children || [];
          const sfr = stackFrame.range();
          const spr = scope.range();

          let range = new Range(0, 0, sfr.startLineNumber, sfr.startColumn);
          if (spr) {
            range = range.setStartPosition(spr.startLineNumber, spr.startColumn);
          }

          return createInlineValueDecorationsInsideRange(
            variables as DebugVariable[],
            range,
            model,
            getWordToLineNumbersMap(editor?.monacoEditor.getModel()!),
          );
        }),
      );

      allDecorations = decorationsPerScope.reduce((previous, current) => previous.concat(current), []);
    }

    editor.monacoEditor.setDecorationsByType(
      'inline-value-decoration',
      INLINE_VALUE_DECORATION_KEY,
      allDecorations as any[],
    );
  }

  // debug exception widget
  private async toggleExceptionWidget(): Promise<void> {
    const currentSession = this.debugSessionManager.currentSession;
    if (!currentSession) {
      this.closeExceptionWidget();
      return;
    }

    const { currentThread } = currentSession;
    if (!currentThread) {
      this.closeExceptionWidget();
      return;
    }

    // 找出第一个调用堆栈帧是引发异常的帧，且 source.presentationHint 为非 deemphasize 的
    const exceptionStack = currentThread.frames.find(
      (s) => !!(s && s.source && s.source.available && s.source.presentationHint !== 'deemphasize'),
    );
    if (!exceptionStack) {
      this.closeExceptionWidget();
      return;
    }

    if (
      currentThread.stoppedDetails?.reason === 'exception' &&
      currentSession.capabilities.supportsExceptionInfoRequest
    ) {
      const exceptionInfo = await currentThread?.fetchExceptionInfo();
      if (exceptionInfo) {
        this.showExceptionWidget(
          exceptionInfo,
          currentSession,
          exceptionStack.range().startLineNumber,
          exceptionStack.range().startColumn,
        );
      }
    }
  }

  private showExceptionWidget(
    exceptionInfo: IDebugExceptionInfo,
    debugSession: DebugSession,
    lineNumber: number,
    column: number,
  ): void {
    if (this.debugExceptionWidget) {
      this.debugExceptionWidget.dispose();
    }

    const editor = debugSession?.currentEditor();

    this.debugExceptionWidget = this.injector.get(DebugExceptionWidget, [editor, exceptionInfo]);
    this.debugExceptionWidget.show(positionToRange({ lineNumber, column }), 10);
    this.debugExceptionWidget.focus();
    editor?.revealRangeInCenter({
      startLineNumber: lineNumber,
      startColumn: column,
      endLineNumber: lineNumber,
      endColumn: column,
    });
    this.debugContextKey.contextExceptionWidgetVisible.set(true);
  }

  private closeExceptionWidget(): void {
    if (this.debugExceptionWidget) {
      this.debugContextKey.contextExceptionWidgetVisible.set(false);
      this.debugExceptionWidget.dispose();
      this.debugExceptionWidget = undefined;
    }
  }
}
