import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AINativeSettingSectionsId,
  ChatResponse,
  Disposable,
  Emitter,
  Event,
  IDisposable,
  ILogger,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';

import { IAIMonacoContribHandler } from '../../contrib/base';
import { EInlineDiffPreviewMode } from '../../preferences/schema';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import { EResultKind } from '../inline-chat/inline-chat.service';
import {
  BaseInlineDiffPreviewer,
  LiveInlineDiffPreviewer,
  SideBySideInlineDiffWidget,
} from '../inline-diff/inline-diff-previewer';
import { InlineDiffWidget } from '../inline-diff/inline-diff-widget';
import { InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';
import { IPartialEditEvent, SerializableState } from '../inline-stream-diff/live-preview.decoration';

@Injectable()
export class InlineDiffHandler extends IAIMonacoContribHandler {
  protected allowAnyScheme = true;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(ILogger)
  private logger: ILogger;

  private readonly _onPartialEditEvent = this.registerDispose(new Emitter<IPartialEditEvent>());
  public readonly onPartialEditEvent: Event<IPartialEditEvent> = this._onPartialEditEvent.event;

  private readonly _onMaxLineCount = new Emitter<number>();
  public readonly onMaxLineCount: Event<number> = this._onMaxLineCount.event;

  protected _editorsStore = new Map<
    monaco.ICodeEditor,
    BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> | undefined
  >();

  protected _store = new Map<
    string,
    {
      state: SerializableState;
      selection: monaco.Selection;
    }
  >();

  doContribute(): IDisposable {
    this.logger.log('InlineDiffHandler doContribute');
    return Disposable.NULL;
  }

  registerInlineDiffFeature(editor: IEditor): IDisposable {
    const disposable = new Disposable();

    const monacoEditor = editor.monacoEditor;

    disposable.addDispose(
      monacoEditor.onWillChangeModel((e) => {
        if (e.oldModelUrl) {
          const oldDiffPreviewer = this._editorsStore.get(monacoEditor);
          if (oldDiffPreviewer instanceof LiveInlineDiffPreviewer) {
            const key = e.oldModelUrl.toString();
            const state = oldDiffPreviewer.serializeState();
            if (state) {
              this._store.set(key, { state, selection: oldDiffPreviewer.getSelection() });
            }
          }
        }
      }),
    );

    disposable.addDispose(
      monacoEditor.onDidChangeModel((e) => {
        if (!e.newModelUrl) {
          return;
        }
        const key = e.newModelUrl.toString();
        const state = this._store.get(key);
        if (!state) {
          return;
        }

        const oldDiffPreviewer = this._editorsStore.get(monacoEditor);
        if (oldDiffPreviewer) {
          oldDiffPreviewer.dispose();
        }

        if (oldDiffPreviewer instanceof LiveInlineDiffPreviewer) {
          const previewer = this.createDiffPreviewer(monacoEditor, state.selection) as LiveInlineDiffPreviewer;
          previewer.restoreState(state.state);
        }
      }),
    );

    return disposable;
  }

  private formatAnswer(answer: string, crossCode: string): string {
    const leadingWhitespaceMatch = crossCode.match(/^\s*/);
    const indent = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '  ';
    return answer
      .split('\n')
      .map((line) => `${indent}${line}`)
      .join('\n');
  }

  showPreviewerByStream(
    monacoEditor: monaco.ICodeEditor,
    options: {
      crossSelection: monaco.Selection;
      chatResponse?: ChatResponse | InlineChatController;
    },
  ): BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> {
    const { crossSelection, chatResponse } = options;

    const disposable = new Disposable();

    const diffPreviewer = this.createDiffPreviewer(monacoEditor, crossSelection);

    const onFinish = () => {
      diffPreviewer.layout();
      disposable.dispose();
    };

    if (InlineChatController.is(chatResponse)) {
      const controller = chatResponse as InlineChatController;

      disposable.addDispose(
        diffPreviewer.onReady(() => {
          controller.deferred.resolve();

          disposable.addDispose([
            controller.onData((data) => {
              if (ReplyResponse.is(data)) {
                diffPreviewer.onData(data);
              }
            }),
            controller.onError((error) => {
              diffPreviewer.onError(error);
              onFinish();
            }),
            controller.onAbort(() => {
              diffPreviewer.onAbort();
              onFinish();
            }),
            controller.onEnd(() => {
              diffPreviewer.onEnd();
              onFinish();
            }),
          ]);
        }),
      );
    } else {
      const model = monacoEditor.getModel();
      const crossCode = model!.getValueInRange(crossSelection);

      const answer = this.formatAnswer((chatResponse as ReplyResponse).message, crossCode);

      disposable.addDispose(
        diffPreviewer.onReady(() => {
          diffPreviewer.setValue(answer);
          onFinish();
        }),
      );
    }

    diffPreviewer.layout();
    return diffPreviewer;
  }

  createDiffPreviewer(monacoEditor: monaco.ICodeEditor, selection: monaco.Selection) {
    let diffPreviewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler>;

    const inlineDiffMode = this.preferenceService.getValid<EInlineDiffPreviewMode>(
      AINativeSettingSectionsId.InlineDiffPreviewMode,
      EInlineDiffPreviewMode.inlineLive,
    );
    if (inlineDiffMode === EInlineDiffPreviewMode.sideBySide) {
      diffPreviewer = this.injector.get(SideBySideInlineDiffWidget, [monacoEditor, selection]);
    } else {
      diffPreviewer = this.injector.get(LiveInlineDiffPreviewer, [monacoEditor, selection]);
    }

    diffPreviewer.show(selection.startLineNumber - 1, selection.endLineNumber - selection.startLineNumber + 2);

    const oldDiffPreviewer = this._editorsStore.get(monacoEditor);

    if (oldDiffPreviewer) {
      oldDiffPreviewer.dispose();
    }

    this._editorsStore.set(monacoEditor, diffPreviewer);

    if (diffPreviewer instanceof LiveInlineDiffPreviewer) {
      diffPreviewer.addDispose(
        diffPreviewer.onPartialEditEvent((event) => {
          this._onPartialEditEvent.fire(event);
        }),
      );
    }

    diffPreviewer.addDispose(diffPreviewer.onLineCount((lineCount) => this._onMaxLineCount.fire(lineCount)));
    return diffPreviewer;
  }

  getPreviewer(
    monacoEditor: monaco.ICodeEditor,
  ): BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> | undefined {
    return this._editorsStore.get(monacoEditor);
  }

  handleAction(monacoEditor: monaco.ICodeEditor, action: EResultKind): void {
    const diffPreviewer = this._editorsStore.get(monacoEditor);
    if (diffPreviewer) {
      diffPreviewer.handleAction(action);
    }
  }

  hidePreviewer(monacoEditor: monaco.ICodeEditor) {
    const diffPreviewer = this._editorsStore.get(monacoEditor);
    if (diffPreviewer) {
      diffPreviewer.dispose();
      this._editorsStore.delete(monacoEditor);
    }
  }
}
