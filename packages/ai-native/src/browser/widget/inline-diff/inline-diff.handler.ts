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

  private diffPreviewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> | undefined;

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
          const key = e.oldModelUrl.toString();
          if (this.diffPreviewer instanceof LiveInlineDiffPreviewer) {
            const state = (this.diffPreviewer as LiveInlineDiffPreviewer).serializeState();
            if (state) {
              this._store.set(key, { state, selection: this.diffPreviewer.getSelection() });
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

        if (typeof this.diffPreviewer !== 'undefined') {
          (this.diffPreviewer as LiveInlineDiffPreviewer).clear();
        }

        const key = e.newModelUrl.toString();
        const state = this._store.get(key);
        if (this.editor && state) {
          const diffPreviewer = this.createDiffPreviewer(this.editor.monacoEditor, state.selection);
          this.attachDiffPreviewer(diffPreviewer);
          (this.diffPreviewer as LiveInlineDiffPreviewer).restoreState(state.state);
        } else {
          this.diffPreviewer = undefined;
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

  protected _previewerDisposable: IDisposable = Disposable.NULL;
  attachDiffPreviewer(previewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler>) {
    if (typeof this.diffPreviewer !== 'undefined') {
      (this.diffPreviewer as LiveInlineDiffPreviewer).clear();
    }

    this._previewerDisposable.dispose();
    this.diffPreviewer = previewer;

    if (previewer instanceof LiveInlineDiffPreviewer) {
      this._previewerDisposable = previewer.onPartialEditEvent((event) => {
        this._onPartialEditEvent.fire(event);
      });
    }
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
    this.attachDiffPreviewer(diffPreviewer);

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

    return diffPreviewer;
  }
}
