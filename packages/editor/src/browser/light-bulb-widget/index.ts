import { asClassNameArrayWrapper } from '@opensumi/ide-core-browser';
import { Sumicon } from '@opensumi/ide-core-common/lib/codicons';
import * as dom from '@opensumi/monaco-editor-core/esm/vs/base/browser/dom';
import { Gesture } from '@opensumi/monaco-editor-core/esm/vs/base/browser/touch';
import { Codicon } from '@opensumi/monaco-editor-core/esm/vs/base/common/codicons';
import { Emitter, Event } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';
import { Disposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import { ThemeIcon } from '@opensumi/monaco-editor-core/esm/vs/base/common/themables';
import '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/browser/lightBulbWidget.css';
import {
  ContentWidgetPositionPreference,
  ICodeEditor,
  IContentWidget,
  IContentWidgetPosition,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IPosition } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import { computeIndentLevel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/utils';
import {
  autoFixCommandId,
  quickFixCommandId,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/browser/codeAction';
import * as nls from '@opensumi/monaco-editor-core/esm/vs/nls';
import { ICommandService } from '@opensumi/monaco-editor-core/esm/vs/platform/commands/common/commands';
import { IKeybindingService } from '@opensumi/monaco-editor-core/esm/vs/platform/keybinding/common/keybinding';

import type {
  CodeActionSet,
  CodeActionTrigger,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/common/types';

namespace LightBulbState {
  export const enum Type {
    Hidden,
    Showing,
  }

  export const Hidden = { type: Type.Hidden } as const;

  export class Showing {
    readonly type = Type.Showing;

    constructor(
      public readonly actions: CodeActionSet,
      public readonly trigger: CodeActionTrigger,
      public readonly editorPosition: IPosition,
      public readonly widgetPosition: IContentWidgetPosition,
    ) {}
  }

  export type State = typeof Hidden | Showing;
}

export class LightBulbWidget extends Disposable implements IContentWidget {
  public static readonly ID = 'editor.contrib.lightbulbWidget';

  private static readonly _posPref = [ContentWidgetPositionPreference.EXACT];

  private readonly _domNode: HTMLElement;

  private readonly _onClick = this._register(
    new Emitter<{
      readonly x: number;
      readonly y: number;
      readonly actions: CodeActionSet;
      readonly trigger: CodeActionTrigger;
    }>(),
  );
  public readonly onClick = this._onClick.event;

  private _state: LightBulbState.State = LightBulbState.Hidden;
  private _iconClasses: string[] = [];

  private _preferredKbLabel?: string;
  private _quickFixKbLabel?: string;

  constructor(
    private readonly _editor: ICodeEditor,
    @IKeybindingService private readonly _keybindingService: IKeybindingService,
    @ICommandService commandService: ICommandService,
  ) {
    super();

    this._domNode = dom.$('div.lightBulbWidget');

    this._register(Gesture.ignoreTarget(this._domNode));

    this._editor.addContentWidget(this);

    this._register(
      this._editor.onDidChangeModelContent((_) => {
        // cancel when the line in question has been removed
        const editorModel = this._editor.getModel();
        if (
          this.state.type !== LightBulbState.Type.Showing ||
          !editorModel ||
          this.state.editorPosition.lineNumber >= editorModel.getLineCount()
        ) {
          this.hide();
        }
      }),
    );

    this._register(
      dom.addStandardDisposableGenericMouseDownListener(this._domNode, (e) => {
        if (this.state.type !== LightBulbState.Type.Showing) {
          return;
        }

        // Make sure that focus / cursor location is not lost when clicking widget icon
        this._editor.focus();
        e.preventDefault();

        // a bit of extra work to make sure the menu
        // doesn't cover the line-text
        const { top, height } = dom.getDomNodePagePosition(this._domNode);
        const lineHeight = this._editor.getOption(EditorOption.lineHeight);

        let pad = Math.floor(lineHeight / 3);
        if (
          this.state.widgetPosition.position !== null &&
          this.state.widgetPosition.position.lineNumber < this.state.editorPosition.lineNumber
        ) {
          pad += lineHeight;
        }

        this._onClick.fire({
          x: e.posx,
          y: top + height + pad,
          actions: this.state.actions,
          trigger: this.state.trigger,
        });
      }),
    );

    this._register(
      dom.addDisposableListener(this._domNode, 'mouseenter', (e: MouseEvent) => {
        if ((e.buttons & 1) !== 1) {
          return;
        }
        // mouse enters lightbulb while the primary/left button
        // is being pressed -> hide the lightbulb
        this.hide();
      }),
    );

    this._register(
      Event.runAndSubscribe(this._keybindingService.onDidUpdateKeybindings, () => {
        this._preferredKbLabel = this._keybindingService.lookupKeybinding(autoFixCommandId)?.getLabel() ?? undefined;
        this._quickFixKbLabel = this._keybindingService.lookupKeybinding(quickFixCommandId)?.getLabel() ?? undefined;

        this._updateLightBulbTitleAndIcon();
      }),
    );
  }

  override dispose(): void {
    super.dispose();
    this._editor.removeContentWidget(this);
  }

  getId(): string {
    return 'LightBulbWidget';
  }

  getDomNode(): HTMLElement {
    return this._domNode;
  }

  getPosition(): IContentWidgetPosition | null {
    return this._state.type === LightBulbState.Type.Showing ? this._state.widgetPosition : null;
  }

  public update(actions: CodeActionSet, trigger: CodeActionTrigger, atPosition: IPosition) {
    if (actions.validActions.length <= 0) {
      return this.hide();
    }

    const options = this._editor.getOptions();
    if (!options.get(EditorOption.lightbulb).enabled) {
      return this.hide();
    }

    const model = this._editor.getModel();
    if (!model) {
      return this.hide();
    }

    const { lineNumber, column } = model.validatePosition(atPosition);

    const tabSize = model.getOptions().tabSize;
    const fontInfo = this._editor.getOptions().get(EditorOption.fontInfo);
    const lineContent = model.getLineContent(lineNumber);
    const indent = computeIndentLevel(lineContent, tabSize);
    const lineHasSpace = fontInfo.spaceWidth * indent > 22;
    const isFolded = (lineNumber: number) =>
      lineNumber > 2 &&
      this._editor.getTopForLineNumber(lineNumber) === this._editor.getTopForLineNumber(lineNumber - 1);

    let effectiveLineNumber = lineNumber;
    let effectiveColumnNumber = 1;
    if (!lineHasSpace) {
      if (lineNumber > 1 && !isFolded(lineNumber - 1)) {
        effectiveLineNumber -= 1;
      } else if (lineNumber < model.getLineCount() && !isFolded(lineNumber + 1)) {
        effectiveLineNumber += 1;
      } else if (column * fontInfo.spaceWidth < 22) {
        // cannot show lightbulb above/below and showing
        // it inline would overlay the cursor...
        return this.hide();
      }
      effectiveColumnNumber = /^\S\s*$/.test(model.getLineContent(effectiveLineNumber)) ? 2 : 1;
    }

    this.state = new LightBulbState.Showing(actions, trigger, atPosition, {
      position: { lineNumber: effectiveLineNumber, column: effectiveColumnNumber },
      preference: LightBulbWidget._posPref,
    });
    this._editor.layoutContentWidget(this);
  }

  public hide(): void {
    if (this.state === LightBulbState.Hidden) {
      return;
    }

    this.state = LightBulbState.Hidden;
    this._editor.layoutContentWidget(this);
  }

  private get state(): LightBulbState.State {
    return this._state;
  }

  private set state(value) {
    this._state = value;
    this._updateLightBulbTitleAndIcon();
  }

  protected _updateLightBulbTitleAndIcon(): void {
    this._domNode.classList.remove(...this._iconClasses);
    this._iconClasses = [];
    if (this.state.type !== LightBulbState.Type.Showing) {
      return;
    }
    let icon: ThemeIcon;
    let autoRun = false;
    if (this.state.actions.allAIFixes) {
      icon = Sumicon.magicWand;
      if (this.state.actions.validActions.length === 1) {
        autoRun = true;
      }
    } else if (this.state.actions.hasAutoFix) {
      if (this.state.actions.hasAIFix) {
        // icon = Codicon.lightbulbSparkleAutofix;
        icon = Sumicon.magicWand;
      } else {
        icon = Codicon.lightbulbAutofix;
      }
    } else if (this.state.actions.hasAIFix) {
      // icon = Codicon.lightbulbSparkle;
      icon = Sumicon.magicWand;
    } else {
      icon = Codicon.lightBulb;
    }
    this._updateLightbulbTitle(this.state.actions.hasAutoFix, autoRun);
    this._iconClasses = asClassNameArrayWrapper(icon);
    this._domNode.classList.add(...this._iconClasses);
  }

  private _updateLightbulbTitle(autoFix: boolean, autoRun: boolean): void {
    if (this.state.type !== LightBulbState.Type.Showing) {
      return;
    }
    if (autoRun) {
      this.title = nls.localize('codeActionAutoRun', 'Run: {0}', this.state.actions.validActions[0].action.title);
    } else if (autoFix && this._preferredKbLabel) {
      this.title = nls.localize(
        'preferredcodeActionWithKb',
        'Show Code Actions. Preferred Quick Fix Available ({0})',
        this._preferredKbLabel,
      );
    } else if (!autoFix && this._quickFixKbLabel) {
      this.title = nls.localize('codeActionWithKb', 'Show Code Actions ({0})', this._quickFixKbLabel);
    } else if (!autoFix) {
      this.title = nls.localize('codeAction', 'Show Code Actions');
    }
  }

  private set title(value: string) {
    this._domNode.title = value;
  }
}
