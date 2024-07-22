import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AINativeSettingSectionsId,
  ChatResponse,
  Disposable,
  Emitter,
  Event,
  IDisposable,
  IEventBus,
  ILogger,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import { EditorGroupCloseEvent, IEditor } from '@opensumi/ide-editor/lib/browser';
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

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

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

  protected _store = new Map<string, SerializableState>();

  constructor() {
    super();
    this.registerDispose(this.eventBus.on(EditorGroupCloseEvent, this.groupCloseHandler.bind(this)));
  }
  doContribute(): IDisposable {
    this.logger.log('InlineDiffHandler doContribute');
    return Disposable.NULL;
  }

  storeState(monacoEditor: monaco.ICodeEditor, key: string) {
    const previous = this._editorsStore.get(monacoEditor);
    if (previous instanceof LiveInlineDiffPreviewer) {
      const state = previous.serializeState();
      if (state) {
        this._store.set(key, state);
      }
    }
    return previous;
  }

  tryRestoreState(monacoEditor: monaco.ICodeEditor, key: string) {
    const state = this._store.get(key);
    if (!state) {
      return;
    }

    return this.restoreState(monacoEditor, state);
  }

  restoreState(monacoEditor: monaco.ICodeEditor, state: SerializableState) {
    const oldDiffPreviewer = this._editorsStore.get(monacoEditor);
    if (oldDiffPreviewer) {
      oldDiffPreviewer.dispose();
    }

    const previewer = this.createDiffPreviewer(monacoEditor, state.selection);
    if (previewer instanceof LiveInlineDiffPreviewer) {
      previewer.restoreState(state);
    }

    return previewer;
  }

  registerInlineDiffFeature(editor: IEditor): IDisposable {
    const disposable = new Disposable();

    const monacoEditor = editor.monacoEditor;

    disposable.addDispose(
      monacoEditor.onWillChangeModel((e) => {
        if (!e.oldModelUrl) {
          return;
        }
        const previewer = this.storeState(monacoEditor, e.oldModelUrl.toString());
        if (previewer) {
          previewer.dispose();
        }
      }),
    );

    disposable.addDispose(
      monacoEditor.onDidChangeModel((e) => {
        if (!e.newModelUrl) {
          return;
        }
        this.tryRestoreState(monacoEditor, e.newModelUrl.toString());
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

    const previewer = this.createDiffPreviewer(monacoEditor, crossSelection);

    const onFinish = () => {
      previewer.layout();
      disposable.dispose();
    };

    if (InlineChatController.is(chatResponse)) {
      const controller = chatResponse as InlineChatController;

      disposable.addDispose(
        previewer.onReady(() => {
          controller.listen();

          disposable.addDispose([
            controller.onData((data) => {
              if (ReplyResponse.is(data)) {
                previewer.onData(data);
              }
            }),
            controller.onError((error) => {
              previewer.onError(error);
              onFinish();
            }),
            controller.onAbort(() => {
              previewer.onAbort();
              onFinish();
            }),
            controller.onEnd(() => {
              previewer.onEnd();
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
        previewer.onReady(() => {
          previewer.setValue(answer);
          onFinish();
        }),
      );
    }

    previewer.layout();
    return previewer;
  }

  createDiffPreviewer(monacoEditor: monaco.ICodeEditor, selection: monaco.Selection) {
    let previewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler>;

    const inlineDiffMode = this.preferenceService.getValid<EInlineDiffPreviewMode>(
      AINativeSettingSectionsId.InlineDiffPreviewMode,
      EInlineDiffPreviewMode.inlineLive,
    );
    if (inlineDiffMode === EInlineDiffPreviewMode.sideBySide) {
      previewer = this.injector.get(SideBySideInlineDiffWidget, [monacoEditor, selection]);
    } else {
      previewer = this.injector.get(LiveInlineDiffPreviewer, [monacoEditor, selection]);
    }

    previewer.show(selection.startLineNumber - 1, selection.endLineNumber - selection.startLineNumber + 2);

    const previous = this._editorsStore.get(monacoEditor);

    const currentModel = monacoEditor.getModel();

    if (currentModel) {
      currentModel.onWillDispose(() => {
        previewer.dispose();
      });
    }

    if (previous) {
      previous.dispose();
    }

    this._editorsStore.set(monacoEditor, previewer);

    if (previewer instanceof LiveInlineDiffPreviewer) {
      previewer.addDispose(
        previewer.onPartialEditEvent((event) => {
          this._onPartialEditEvent.fire(event);
        }),
      );
    }

    previewer.addDispose(previewer.onLineCount((lineCount) => this._onMaxLineCount.fire(lineCount)));
    return previewer;
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

  revealFirstDiff(monacoEditor: monaco.ICodeEditor) {
    const diffPreviewer = this._editorsStore.get(monacoEditor);
    if (diffPreviewer) {
      diffPreviewer.revealFirstDiff();
    }
  }

  private async groupCloseHandler(e: EditorGroupCloseEvent) {
    const uriString = e.payload.resource.uri.toString();

    const previewer = this._editorsStore.get(e.payload.group.codeEditor.monacoEditor);

    if (previewer) {
      if (previewer.isModel(uriString)) {
        previewer.dispose();
      }
    }

    this._store.delete(uriString);
  }
}
