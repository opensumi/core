import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  IAICompletionOption,
  IDisposable,
  IntelligentCompletionsRegistryToken,
  isUndefined,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import { ICodeEditor, IRange, ITextModel, Position, Range, TrackedRangeStickiness } from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { RewriteWidget } from '../../widget/rewrite/rewrite-widget';

import { AdditionsDeletionsDecorationModel } from './additions-deletions.decoration';
import { IMultiLineDiffChangeResult, MultiLineDiffComputer, RewriteDiffComputer } from './diff-computer';
import { IIntelligentCompletionsResult } from './intelligent-completions';
import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';
import styles from './intelligent-completions.module.less';
import { MultiLineDecorationModel } from './multi-line.decoration';

@Injectable()
export class IntelligentCompletionsHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IntelligentCompletionsRegistryToken)
  private intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  private cancelIndicator = new CancellationTokenSource();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  private multiLineDiffComputer: MultiLineDiffComputer = new MultiLineDiffComputer();
  private rewriteDiffComputer: RewriteDiffComputer = new RewriteDiffComputer();

  private multiLineDecorationModel: MultiLineDecorationModel;
  private additionsDeletionsDecorationModel: AdditionsDeletionsDecorationModel;

  private editor: IEditor;
  private aiNativeContextKey: AINativeContextKey;

  private get monacoEditor(): ICodeEditor {
    return this.editor.monacoEditor;
  }

  private get model(): ITextModel {
    return this.monacoEditor.getModel()!;
  }

  private rewriteWidget: RewriteWidget;

  private mergeDiffChanges(lines: IMultiLineDiffChangeResult[], eol: string): IMultiLineDiffChangeResult[] {
    const modifiedLines = lines.flatMap((line) => {
      const segments = line.value.split(eol);
      const wrap = (value: string): IMultiLineDiffChangeResult => ({ value, added: line.added, removed: line.removed });

      return segments
        .flatMap((segment, index) => {
          if (index < segments.length - 1) {
            return [wrap(segment), wrap(eol)];
          }

          return wrap(segment);
        })
        .filter((line) => line.value !== empty);
    });

    // 对处理后的结果进行调整，确保相邻的添加和删除操作合并
    for (let i = 0; i < modifiedLines.length - 1; i++) {
      const currentLine = modifiedLines[i];
      const nextLine = modifiedLines[i + 1];
      // 如果当前行是删除操作，下一行是添加操作，并且下一行的值以当前行的值开头，则合并这两个操作
      if (currentLine.removed && nextLine.added && nextLine.value.startsWith(currentLine.value)) {
        currentLine.added = true;
        currentLine.removed = true;
      }
    }

    return modifiedLines;
  }

  /**
   * 根据原始内容和要修改的内容，返回字符级或单词级的差异
   * @param originalContent 原始内容
   * @param modifiedContent 修改后的内容
   * @param lineNumber 行号
   * @param eol 行结束符
   * @returns
   */
  private getChanges(originalContent: string, modifiedContent: string, lineNumber: number, eol: string) {
    let rewriteDiffResult: IMultiLineDiffChangeResult[] =
      this.rewriteDiffComputer.diff(originalContent, modifiedContent) || [];
    let multiLineDiffResult: IMultiLineDiffChangeResult[] =
      this.multiLineDiffComputer.diff(originalContent, modifiedContent) || [];

    let isModified = false;

    const originalLines = originalContent.split(eol);
    const modifiedLines = modifiedContent.split(eol);

    try {
      if (
        !isModified &&
        originalLines.length === modifiedLines.length &&
        originalLines.every((value, index) => modifiedLines[index].startsWith(value))
      ) {
        isModified = true;
        multiLineDiffResult = originalLines
          .map((value, index) => {
            const modifiedLine = modifiedLines[index];
            const diffElements: IMultiLineDiffChangeResult[] = [
              {
                value,
              },
            ];

            if (modifiedLine !== value) {
              const addedPart = modifiedLine.substring(value.length);
              diffElements.push({
                value: addedPart,
                added: true,
              });
              diffElements.push({
                value: eol,
              });
            } else {
              diffElements[0].value = diffElements[0].value + eol;
            }
            return diffElements;
          })
          .flat();
      }

      const currentCursorPosition = this.monacoEditor.getPosition();
      const lineAndColumn = {
        lineNumber: (currentCursorPosition?.lineNumber ?? 1) - lineNumber + 1,
        column: currentCursorPosition?.column ?? 1,
      };

      if (!isModified && !isUndefined(currentCursorPosition) && lineAndColumn) {
        const prefix = originalLines.slice(0, lineAndColumn.lineNumber - 1).join(eol);
        const linePrefix = originalLines[lineAndColumn.lineNumber - 1].slice(0, lineAndColumn.column - 1);

        const prefixMatch = prefix === modifiedLines.slice(0, lineAndColumn.lineNumber - 1).join(eol);
        const linePrefixMatch =
          linePrefix === modifiedLines[lineAndColumn.lineNumber - 1].slice(0, lineAndColumn.column - 1);

        if (prefixMatch && linePrefixMatch) {
          const modifiedContent =
            modifiedLines[lineAndColumn.lineNumber - 1].slice(lineAndColumn.column - 1) +
            eol +
            modifiedLines.slice(lineAndColumn.lineNumber).join(eol);
          const originalContent =
            originalLines[lineAndColumn.lineNumber - 1].slice(lineAndColumn.column - 1) +
            eol +
            originalLines.slice(lineAndColumn.lineNumber).join(eol);
          const commonPrefix =
            prefix + (originalLines.slice(0, lineAndColumn.lineNumber - 1).length > 0 ? eol : empty) + linePrefix;

          if (modifiedContent.endsWith(originalContent)) {
            isModified = true;
            const modifiedContentPrefix = modifiedContent.slice(0, modifiedContent.length - originalContent.length);
            multiLineDiffResult = [
              {
                value: commonPrefix,
              },
              {
                value: modifiedContentPrefix,
                added: true,
              },
              {
                value: originalContent,
              },
            ];
          }
        }
      }
    } catch (error) {
      // error
    }

    const mergeRewriteLine = this.mergeDiffChanges(rewriteDiffResult, eol);
    const isOnlyAddingToEachWord = !mergeRewriteLine.some(
      (item) => item.added !== true && item.removed === true && item.value !== eol,
    );

    const mergeMultiLine = this.mergeDiffChanges(multiLineDiffResult, eol);

    return {
      singleLineCharChanges: mergeMultiLine,
      charChanges: multiLineDiffResult,
      wordChanges: rewriteDiffResult,
      isOnlyAddingToEachWord,
    };
  }

  public async fetchProvider(bean: IAICompletionOption): Promise<IIntelligentCompletionsResult | undefined> {
    const provider = this.intelligentCompletionsRegistry.getProvider();
    if (!provider) {
      return;
    }

    const position = this.monacoEditor.getPosition()!;
    const intelligentCompletionModel = await provider(this.monacoEditor, position, bean, this.cancelIndicator.token);

    if (
      intelligentCompletionModel &&
      intelligentCompletionModel.enableMultiLine &&
      intelligentCompletionModel.items.length > 0
    ) {
      return this.applyInlineDecorations(intelligentCompletionModel);
    }

    return intelligentCompletionModel;
  }

  public applyInlineDecorations(completionModel: IIntelligentCompletionsResult) {
    const { items } = completionModel;

    const position = this.monacoEditor.getPosition()!;
    const model = this.monacoEditor.getModel();
    const { range, insertText } = items[0];
    const insertTextString = insertText.toString();

    // 如果只是开启了 enableMultiLine 而没有传递 range ，则不显示 multi line
    if (!range) {
      return completionModel;
    }

    const originalContent = model?.getValueInRange(range);
    const eol = this.model.getEOL();

    const changes = this.getChanges(originalContent!, insertTextString, range.startLineNumber, eol);

    if (!changes) {
      return;
    }

    const { singleLineCharChanges, charChanges, wordChanges, isOnlyAddingToEachWord } = changes;

    let isEOLAdded = false;
    let isMiddle = false;
    let isEnd = false;

    for (const change of singleLineCharChanges) {
      if (change.added && change.value === eol) {
        isEnd = true;
        if (!change.added && !change.removed) {
          if (change.value === eol) {
            isMiddle = false;
            isEnd = false;
          } else {
            if (isMiddle && isEnd) {
              isEOLAdded = true;
              break;
            }
            isMiddle = true;
          }
        }
      }
    }

    const startOffset = this.model.getOffsetAt(
      Position.lift({ lineNumber: range.startLineNumber, column: range.startColumn }),
    );
    const endOffset = this.model.getOffsetAt(
      Position.lift({ lineNumber: range.endLineNumber, column: range.endColumn }),
    );
    const allText = this.model.getValue();
    // 这里是为了能在 rewrite widget 的 editor 当中完整的复用代码高亮与语法检测的能力
    const newValue = allText.substring(0, startOffset) + insertText + allText.substring(endOffset);

    if (position && isOnlyAddingToEachWord && !isEOLAdded && charChanges.length <= 20 && wordChanges.length <= 20) {
      const modificationsResult = this.multiLineDecorationModel.applyInlineDecorations(
        this.monacoEditor,
        this.mergeDiffChanges(singleLineCharChanges, eol),
        position.lineNumber,
        position,
      );
      if (!modificationsResult) {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.reset();
        this.multiLineDecorationModel.clearDecorations();
        this.showChangesOnTheRight(wordChanges, model, eol, range, newValue);
      } else if (modificationsResult && modificationsResult.inlineMods) {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.set(true);
        this.multiLineDecorationModel.updateLineModificationDecorations(modificationsResult.inlineMods);
      }
    } else {
      const deletionRanges = this.additionsDeletionsDecorationModel.generateRange(
        wordChanges.map((change) => {
          const value = change.value;

          if (change.removed) {
            return { value, added: true };
          } else if (change.added) {
            return { value, removed: true };
          }

          return change;
        }),
        range,
        eol,
      );

      this.additionsDeletionsDecorationModel.setDeletionsDecoration(
        deletionRanges.map((range) => ({
          range,
          options: {
            description: 'suggestion_deletions_background',
            className: styles.suggestion_deletions_background,
            stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        })),
      );

      this.showChangesOnTheRight(wordChanges, model, eol, range, newValue);
    }
  }

  private showChangesOnTheRight(
    wordChanges: IMultiLineDiffChangeResult[],
    model: ITextModel | null,
    eol: string,
    range: IRange,
    newValue: string,
  ) {
    const lineChangesMap: { [lineNumber in number]: IMultiLineDiffChangeResult[][] } = {};
    let currentLineNumber = range.startLineNumber;

    this.rewriteWidget.hide();

    const cursorPosition = this.monacoEditor.getPosition();
    if (!cursorPosition) {
      return;
    }

    const getLastLineChanges = () => {
      if (!lineChangesMap[currentLineNumber]) {
        lineChangesMap[currentLineNumber] = [];
      }
      const lastLineIndex = lineChangesMap[currentLineNumber].length - 1;
      if (lastLineIndex < 0) {
        lineChangesMap[currentLineNumber][0] = [];
        return lineChangesMap[currentLineNumber][0];
      }
      let lastLineChanges = lineChangesMap[currentLineNumber][lastLineIndex];
      if (!lastLineChanges) {
        lineChangesMap[currentLineNumber][lastLineIndex] = [];
        lastLineChanges = lineChangesMap[currentLineNumber][lastLineIndex];
      }
      return lastLineChanges;
    };

    const addNewLineChanges = (change: IMultiLineDiffChangeResult) => {
      const currentLineChanges = lineChangesMap[currentLineNumber];
      if (!currentLineChanges) {
        lineChangesMap[currentLineNumber] = [[change]];
        return;
      }
      currentLineChanges.push([change]);
    };

    const pushToLastLineChanges = (change: IMultiLineDiffChangeResult) => {
      getLastLineChanges().push(change);
    };

    const moveNextLine = () => {
      const totalLines = model?.getLineCount() ?? 1;
      currentLineNumber >= totalLines || (currentLineNumber++, (lineChangesMap[currentLineNumber] = []));
    };

    for (let changeIndex = 0; changeIndex < wordChanges.length; changeIndex++) {
      const currentChange = wordChanges[changeIndex];
      const { value: currentValue, added: isAdded, removed: isRemoved } = currentChange;
      const splitValue = currentValue.split(eol);
      if (isAdded) {
        if (changeIndex === 0) {
          const previousLine = range.startLineNumber - 1;
          const previousLineContent = model!.getLineContent(previousLine);
          lineChangesMap[previousLine] = [
            [
              {
                value: previousLineContent,
              },
            ],
            ...currentChange.value.split(eol).map((segment) => [
              {
                value: segment,
                added: true,
              },
            ]),
          ];
          continue;
        }
        for (let segmentIndex = 0; segmentIndex < splitValue.length; segmentIndex++) {
          const currentSegment = splitValue[segmentIndex];
          if (segmentIndex === 0) {
            pushToLastLineChanges({
              value: currentSegment,
              added: isAdded,
              removed: isRemoved,
            });
            continue;
          }
          segmentIndex === splitValue.length - 1 && changeIndex !== wordChanges.length - 1 && moveNextLine(),
            addNewLineChanges({
              value: currentSegment,
              added: isAdded,
              removed: isRemoved,
            });
        }
        continue;
      }
      if (isRemoved) {
        if (currentValue.replace(/\r?\n/g, empty) === empty) {
          continue;
        }
        for (let segmentIndex = 0; segmentIndex < splitValue.length; segmentIndex++) {
          const currentSegment = splitValue[segmentIndex];
          if (segmentIndex === 0) {
            pushToLastLineChanges({
              value: currentSegment,
              added: isAdded,
              removed: isRemoved,
            });
            continue;
          }
          currentSegment !== empty &&
            (moveNextLine(),
            addNewLineChanges({
              value: currentSegment,
              added: isAdded,
              removed: isRemoved,
            }));
        }
        continue;
      }
      if (currentValue === eol) {
        const previousChange = wordChanges[changeIndex - 1];
        if (previousChange && previousChange.added && previousChange.value.includes(eol)) {
          const lastLineChanges = getLastLineChanges();
          const lastChange = lastLineChanges.pop();
          lastLineChanges.length === 0 && currentLineNumber > 0 && lineChangesMap[currentLineNumber--].pop(),
            addNewLineChanges({
              value: lastChange?.value ?? empty,
              added: true,
            });
          continue;
        }
      }
      for (let segmentIndex = 0; segmentIndex < splitValue.length; segmentIndex++) {
        const currentSegment = splitValue[segmentIndex];
        if (segmentIndex === 0) {
          pushToLastLineChanges({
            value: currentSegment,
            added: isAdded,
            removed: isRemoved,
          });
          continue;
        }
        if (segmentIndex !== splitValue.length - 1) {
          moveNextLine();
        } else {
          const nextChange = wordChanges[changeIndex + 1];
          nextChange &&
            (nextChange.removed || (nextChange.added && currentSegment !== empty && !nextChange.value.includes(eol))) &&
            moveNextLine();
        }
        addNewLineChanges({
          value: currentSegment,
          added: isAdded,
          removed: isRemoved,
        });
      }
    }

    const allLineChanges = Object.values(lineChangesMap).map((lineChanges) => ({
      changes: lineChanges
        .map((change) => change.filter((item) => item.value.trim() !== empty))
        .filter((change) => change.length > 0),
    }));

    this.rewriteWidget.show({ position: cursorPosition });

    if (allLineChanges.every(({ changes }) => changes.every((change) => change.every(({ removed }) => removed)))) {
      // 处理全是删除的情况
      this.rewriteWidget.renderTextLineThrough(range, allLineChanges);
    } else {
      this.rewriteWidget.renderVirtualEditor(newValue, range, wordChanges);
    }
  }

  public hide() {
    this.cancelToken();
    this.aiNativeContextKey.multiLineCompletionsIsVisible.reset();
    this.multiLineDecorationModel.clearDecorations();
  }

  public accept() {
    const edits = this.multiLineDecorationModel.getEdits();

    this.editor.monacoEditor.pushUndoStop();
    this.editor.monacoEditor.executeEdits(
      'multiLineCompletions.accept',
      edits.map((edit) =>
        EditOperation.insert(
          Position.lift({ lineNumber: edit.range.startLineNumber, column: edit.range.startColumn }),
          edit.text,
        ),
      ),
    );

    this.hide();
  }

  public registerFeature(editor: IEditor): IDisposable {
    this.editor = editor;
    const { monacoEditor } = editor;

    this.rewriteWidget = this.injector.get(RewriteWidget, [monacoEditor]);

    this.multiLineDecorationModel = new MultiLineDecorationModel(monacoEditor);
    this.additionsDeletionsDecorationModel = new AdditionsDeletionsDecorationModel(monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [monacoEditor.contextKeyService]);
    return this;
  }
}
