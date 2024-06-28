import cls from 'classnames';
import React, { useEffect } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { KeybindingRegistry, StackingLevel } from '@opensumi/ide-core-browser';
import { AI_INLINE_DIFF_PARTIAL_EDIT } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Disposable, isUndefined, uuid } from '@opensumi/ide-core-common';
import { ICodeEditor, IEditorDecorationsCollection, Position, Range, Selection } from '@opensumi/ide-monaco';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { renderLines } from '../ghost-text-widget/index';

import styles from './inline-stream-diff.module.less';

const ZoneDescription = 'zone-description';
const ActiveLineDecoration = 'activeLine-decoration';
const AddedRangeDecoration = 'added-range-decoration';
const PendingRangeDecoration = 'pending-range-decoration';

interface IPartialEditWidgetComponent {
  acceptSequence: string;
  discardSequence: string;
}

const PartialEditWidgetComponent = ({ acceptSequence, discardSequence }: IPartialEditWidgetComponent) => (
    <div className={styles.inline_diff_accept_partial_widget_container}>
      <div className={styles.content}>
        <span className={cls(styles.accept_btn, styles.btn)}>{acceptSequence}</span>
        <span className={cls(styles.discard_btn, styles.btn)}>{discardSequence}</span>
      </div>
    </div>
  );

@Injectable({ multiple: true })
class AcceptPartialEditWidget extends ReactInlineContentWidget {
  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  private _id: string;

  positionPreference = [ContentWidgetPositionPreference.EXACT];

  private getSequenceKeyStrings(): IPartialEditWidgetComponent | undefined {
    let keybindings = this.keybindingRegistry.getKeybindingsForCommand(AI_INLINE_DIFF_PARTIAL_EDIT.id);
    keybindings = keybindings.sort((a, b) => b.args - a.args);

    if (!keybindings || (keybindings.length !== 2 && keybindings.some((k) => isUndefined(k.resolved)))) {
      return;
    }

    return {
      acceptSequence: this.keybindingRegistry.acceleratorForSequence(keybindings[0].resolved!, '')[0],
      discardSequence: this.keybindingRegistry.acceleratorForSequence(keybindings[1].resolved!, '')[0],
    };
  }

  public renderView(): React.ReactNode {
    const keyStrings = this.getSequenceKeyStrings();
    if (!keyStrings) {
      return;
    }
    return (
      <PartialEditWidgetComponent
        acceptSequence={keyStrings.acceptSequence}
        discardSequence={keyStrings.discardSequence}
      />
    );
  }

  public id(): string {
    if (!this._id) {
      this._id = `AcceptPartialEditWidgetID_${uuid(4)}`;
    }
    return this._id;
  }

  public getClassName(): string {
    return styles.accept_partial_edit_widget_id;
  }
}

const RemovedWidgetComponent = ({ dom, marginWidth }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dom && ref && ref.current) {
      ref.current.appendChild(dom);
    }
  }, [dom, ref]);

  return <div className={styles.inline_diff_remove_zone} ref={ref} style={{ marginLeft: marginWidth + 'px' }}></div>;
};

class RemovedZoneWidget extends ZoneWidget {
  private root: ReactDOMClient.Root;

  _fillContainer(container: HTMLElement): void {
    container.classList.add(styles.inline_diff_remove_zone_widget_container);
    this.root = ReactDOMClient.createRoot(container);
  }

  renderDom(dom: HTMLElement, options: { marginWidth: number }): void {
    this.root.render(<RemovedWidgetComponent dom={dom} marginWidth={options.marginWidth} />);
  }

  override revealRange(): void {}
  dispose(): void {
    this.root.unmount();
    super.dispose();
  }
}

interface ITextLinesTokens {
  text: string;
  lineTokens: LineTokens;
}

@Injectable({ multiple: true })
export class LivePreviewDiffDecorationModel extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private zoneDec: IEditorDecorationsCollection;

  private activeLineDec: IEditorDecorationsCollection;
  private pendingRangeDec: IEditorDecorationsCollection;
  private addedRangeDec: IEditorDecorationsCollection;

  private partialEditWidgetList: AcceptPartialEditWidget[] = [];
  private removedZoneWidgets: Array<RemovedZoneWidget> = [];
  private rawOriginalTextLinesTokens: ITextLinesTokens[] = [];

  private zone: LineRange;
  private aiNativeContextKey: AINativeContextKey;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.zoneDec = this.monacoEditor.createDecorationsCollection();

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.addedRangeDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();

    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);

    this.updateZone(
      LineRange.fromRangeInclusive(
        Range.fromPositions(
          { lineNumber: this.selection.startLineNumber, column: 1 },
          { lineNumber: this.selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
        ),
      ),
    );
  }

  override dispose(): void {
    super.dispose();

    this.zoneDec.clear();

    this.clearPendingLine();
    this.clearActiveLine();
    this.clearAddedLine();
    this.clearRemovedWidgets();
    this.clearPartialEditWidgetList();
  }

  public calcTextLinesTokens(rawOriginalTextLines: string[]): void {
    this.rawOriginalTextLinesTokens = rawOriginalTextLines.map((text, index) => {
      const model = this.monacoEditor.getModel()!;
      const zone = this.getZone();
      const lineNumber = zone.startLineNumber + index;

      model.tokenization.forceTokenization(lineNumber);
      const lineTokens = model.tokenization.getLineTokens(lineNumber);

      return {
        text,
        lineTokens,
      };
    });
  }

  public showRemovedWidgetByLineNumber(
    lineNumber: number,
    removedLinesOriginalRange: LineRange,
    texts: string[],
  ): void {
    const position = new Position(lineNumber, this.monacoEditor.getModel()!.getLineMaxColumn(lineNumber) || 1);
    const heightInLines = texts.length;

    const widget = new RemovedZoneWidget(this.monacoEditor, {
      showInHiddenAreas: true,
      showFrame: false,
      showArrow: false,
    });

    widget.create();

    const dom = document.createElement('div');
    renderLines(
      dom,
      this.monacoEditor.getOption(EditorOption.tabIndex),
      texts.map((content, index) => ({
        content,
        decorations: [],
        lineTokens: this.rawOriginalTextLinesTokens[removedLinesOriginalRange.startLineNumber - 1 + index].lineTokens,
      })),
      this.monacoEditor.getOptions(),
    );

    const layoutInfo = this.monacoEditor.getOption(EditorOption.layoutInfo);
    const marginWidth = layoutInfo.contentLeft;

    widget.renderDom(dom, { marginWidth });
    widget.show(position, heightInLines);

    this.removedZoneWidgets.push(widget);
  }

  public updateZone(newZone: LineRange): void {
    this.zone = newZone;

    this.zoneDec.set([
      {
        range: newZone.toInclusiveRange()!,
        options: ModelDecorationOptions.register({
          description: ZoneDescription,
          className: styles.inline_diff_zone,
          isWholeLine: true,
        }),
      },
    ]);
  }

  public getZone(): LineRange {
    return this.zone;
  }

  public touchActiveLine(lineNumber: number) {
    const zone = this.getZone();

    this.activeLineDec.set([
      {
        range: Range.fromPositions(
          {
            lineNumber: zone.startLineNumber + lineNumber - 1,
            column: 0,
          },
          {
            lineNumber: zone.startLineNumber + lineNumber - 1,
            column: Number.MAX_SAFE_INTEGER,
          },
        ),
        options: ModelDecorationOptions.register({
          description: ActiveLineDecoration,
          isWholeLine: true,
          className: styles.inline_diff_current,
          zIndex: StackingLevel.WorkbenchEditor,
        }),
      },
    ]);
  }

  public touchPartialEditWidgets(ranges: LineRange[]) {
    this.clearPartialEditWidgetList();
    const zone = this.getZone();

    ranges.forEach((range) => {
      const startLineNumber = range.startLineNumber;

      const acceptPartialEditWidget = this.injector.get(AcceptPartialEditWidget, [this.monacoEditor]);
      acceptPartialEditWidget.show({ position: { lineNumber: zone.startLineNumber + startLineNumber - 1, column: 1 } });

      this.partialEditWidgetList.push(acceptPartialEditWidget);
    });

    this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.set(true);
  }

  public touchAddedRange(ranges: LineRange[]) {
    const zone = this.getZone();

    this.addedRangeDec.set(
      ranges
        .filter((r) => r.length > 0)
        .map((range) => ({
          range: Range.fromPositions(
            {
              lineNumber: zone.startLineNumber + range.startLineNumber - 1,
              column: 1,
            },
            {
              lineNumber: zone.startLineNumber + range.endLineNumberExclusive - 2,
              column: Number.MAX_SAFE_INTEGER,
            },
          ),
          options: ModelDecorationOptions.register({
            description: AddedRangeDecoration,
            isWholeLine: true,
            className: styles.inline_diff_added_range,
          }),
        })),
    );
  }

  public touchPendingRange(range: LineRange) {
    const zone = this.getZone();

    this.pendingRangeDec.set([
      {
        range: Range.fromPositions(
          {
            lineNumber: zone.startLineNumber + range.startLineNumber - 1,
            column: 0,
          },
          {
            lineNumber: zone.startLineNumber + range.endLineNumberExclusive - 2,
            column: Number.MAX_SAFE_INTEGER,
          },
        ),
        options: ModelDecorationOptions.register({
          description: PendingRangeDecoration,
          isWholeLine: true,
          className: styles.inline_diff_pending_range,
        }),
      },
    ]);
  }

  public clearPendingLine() {
    this.pendingRangeDec.clear();
  }

  public clearActiveLine() {
    this.activeLineDec.clear();
  }

  public clearAddedLine() {
    this.addedRangeDec.clear();
  }

  public clearPartialEditWidgetList() {
    this.partialEditWidgetList.forEach((widget) => {
      widget.dispose();
    });
    this.partialEditWidgetList = [];
    this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.set(false);
  }

  public clearRemovedWidgets() {
    this.removedZoneWidgets.forEach((widget) => {
      widget.dispose();
    });
    this.removedZoneWidgets = [];
  }
}
