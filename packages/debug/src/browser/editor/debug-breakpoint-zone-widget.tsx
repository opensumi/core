import React from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { Select, Option } from '@opensumi/ide-components';
import { localize, Emitter, Event } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-editor';
import { ZoneWidget } from '@opensumi/ide-monaco-enhance';
import { ICSSStyleService } from '@opensumi/ide-theme';
import * as monacoModes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  BreakpointChangeData,
  DebugBreakpointWidgetContext,
  DebugEditor,
  TSourceBrekpointProperties,
} from '../../common';
import { DebugBreakpointsService } from '../view/breakpoints/debug-breakpoints.service';

import styles from './debug-breakpoint.module.less';

@Injectable({ multiple: true })
export class DebugBreakpointZoneWidget extends ZoneWidget {
  protected _fillContainer(container: HTMLElement): void {}

  static INPUT_PLACEHOLDER_AFTER = styles.input_placeholder + '::after';

  @Autowired(DebugBreakpointsService)
  protected debugBreakpointsService: DebugBreakpointsService;

  @Autowired(ICSSStyleService)
  protected readonly cssManager: ICSSStyleService;

  private _wrapper: HTMLDivElement;
  private _selection: HTMLDivElement;
  private _input: HTMLDivElement;

  protected readonly _onDidChangeBreakpoint = new Emitter<BreakpointChangeData>();
  readonly onDidChangeBreakpoint: Event<BreakpointChangeData> = this._onDidChangeBreakpoint.event;

  protected readonly _onFocus = new Emitter<void>();
  readonly onFocus: Event<void> = this._onFocus.event;

  protected readonly _onBlur = new Emitter<void>();
  readonly onBlur: Event<void> = this._onBlur.event;

  private input: ICodeEditor | undefined;

  get values() {
    return {
      ...this.contexts,
      [this.context]: this.input ? this.input.monacoEditor.getValue() || undefined : undefined,
    };
  }

  get breakpointType(): TSourceBrekpointProperties {
    return this.context;
  }

  constructor(
    public editor: DebugEditor,
    private readonly contexts: DebugBreakpointWidgetContext = {},
    private context: TSourceBrekpointProperties = 'condition',
  ) {
    super(editor);

    this._wrapper = document.createElement('div');
    this._selection = document.createElement('div');
    this._input = document.createElement('div');

    this._container.appendChild(this._wrapper);
    this._wrapper.appendChild(this._selection);
    this._wrapper.appendChild(this._input);

    ReactDOM.render(<></>, this._input);
  }

  public hide(): void {
    if (this.input) {
      this.input.dispose();
      this.input = undefined;
    }
    super.dispose();
  }

  public show(where: monaco.IRange, heightInLines: number): void {
    super.show(where, heightInLines);

    this.debugBreakpointsService.createBreakpointInput(this._input).then((inputEditor: ICodeEditor) => {
      this.input = inputEditor;

      const { monacoEditor } = this.input;
      this.setInputMode();

      this.addDispose(
        monacoEditor.onDidBlurEditorWidget(() => {
          this.inputBlurHandler();
        })!,
      );
      this.addDispose(
        monacoEditor.onDidFocusEditorWidget(() => {
          this.inputFocusHandler();
        })!,
      );
      this.addDispose(
        monacoEditor.onDidChangeModelContent((textModel: monaco.editor.IModelContentChangedEvent) => {
          if (!this.input) {
            return;
          }

          const value = monacoEditor.getValue();
          if (value.length === 0) {
            this.ensureRenderPlaceholder();
          } else {
            this.clearPlaceholder();
          }

          const lineNum = monacoEditor.getModel()!.getLineCount();
          this._relayout(lineNum + 1);
        }),
      );

      this.syncPreContent();
    });
  }

  protected createDecorations(): void {
    if (!this.input) {
      return;
    }

    if (this.input.monacoEditor.getValue().length !== 0) {
      return;
    }

    this.input.monacoEditor.deltaDecorations(
      [],
      [
        {
          range: {
            startLineNumber: 1,
            endLineNumber: 0,
            startColumn: 0,
            endColumn: 1,
          },
          options: {
            description: 'debug-breakpoint-zone-widget',
            afterContentClassName: styles.input_placeholder,
          },
        },
      ],
    );
  }

  protected renderOption(context: TSourceBrekpointProperties, label: string): JSX.Element {
    return <Option value={context}>{label}</Option>;
  }

  protected readonly inputFocusHandler = () => {
    this._onFocus.fire();
  };

  protected readonly inputBlurHandler = () => {
    this._onBlur.fire();
  };

  protected readonly selectContextHandler = (value: TSourceBrekpointProperties) => {
    if (this.input) {
      this.contexts[this.context] = this.input.monacoEditor.getValue() || undefined;
    }

    this.context = value;
    this.setInputMode();
    this.render();
  };

  private setInputMode(): void {
    const languageIdentifier = this.editor.getModel()?.getLanguageIdentifier();
    const model = this.input!.monacoEditor.getModel();
    if (model && languageIdentifier) {
      model.setMode(
        this.context === 'logMessage' ? new monacoModes.LanguageIdentifier('plaintext', 1) : languageIdentifier,
      );
    }
  }

  private renderPlaceholder() {
    if (!this.input) {
      return;
    }

    this.clearPlaceholder();

    const content = `'${this.placeholder}' !important`;
    this.cssManager.addClass(DebugBreakpointZoneWidget.INPUT_PLACEHOLDER_AFTER, { content });
  }

  private ensureRenderPlaceholder() {
    if (!this.input) {
      return;
    }

    this.createDecorations();
    this.renderPlaceholder();
  }

  private syncPreContent(): void {
    if (this.input) {
      this.input.focus();
      const preContent = this.contexts[this.context] || '';
      this.input.monacoEditor.setValue(preContent);
    }
  }

  private clearPlaceholder() {
    this.cssManager.removeClass(DebugBreakpointZoneWidget.INPUT_PLACEHOLDER_AFTER);
  }

  applyClass() {
    this._wrapper.className = styles.debug_breakpoint_wrapper;
    this._selection.className = styles.debug_breakpoint_selected;
    this._input.className = styles.debug_breakpoint_input;
  }

  applyStyle() {
    this.syncPreContent();

    ReactDOM.render(
      <Select
        value={this.context}
        selectedRenderer={() => <span className='kt-select-option'>{this.getContextToLocalize(this.context)}</span>}
        onChange={this.selectContextHandler}
      >
        {this.renderOption('condition', this.getContextToLocalize('condition'))}
        {this.renderOption('hitCondition', this.getContextToLocalize('hitCondition'))}
        {this.renderOption('logMessage', this.getContextToLocalize('logMessage'))}
      </Select>,
      this._selection,
    );
  }

  getContextToLocalize(ctx: TSourceBrekpointProperties) {
    switch (ctx) {
      case 'logMessage':
        return localize('debug.expression.logMessage');
      case 'hitCondition':
        return localize('debug.expression.hitCondition');
      default:
        return localize('debug.expression.condition');
    }
  }

  get placeholder() {
    switch (this.context) {
      case 'logMessage':
        return localize('debug.expression.log.placeholder');
      case 'hitCondition':
        return localize('debug.expression.hit.placeholder');
      default:
        return localize('debug.expression.condition.placeholder');
    }
  }
}
