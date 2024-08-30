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
  IDiffPreviewerOptions,
  LiveInlineDiffPreviewer,
  SideBySideInlineDiffWidget,
} from '../inline-diff/inline-diff-previewer';
import { InlineDiffWidget } from '../inline-diff/inline-diff-widget';
import { InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';
import { IPartialEditEvent } from '../inline-stream-diff/live-preview.component';

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

  private previewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> | undefined;

  private _previewerNodeStore = new Map<string, InlineStreamDiffHandler | null>();

  constructor() {
    super();
    this.registerDispose(
      this.eventBus.on(EditorGroupCloseEvent, (e: EditorGroupCloseEvent) => {
        const uriString = e.payload.resource.uri.toString();
        const node = this.getStoredState(uriString);

        if (node && node.previewerOptions.disposeWhenEditorClosed) {
          this.destroyPreviewer(uriString);
        }
      }),
    );
  }

  doContribute(): IDisposable {
    this.logger.log('InlineDiffHandler doContribute');
    return Disposable.NULL;
  }

  storeState(key: string) {
    if (!this.previewer) {
      return;
    }

    // 存储的是快照
    const node = this.previewer.createNodeSnapshot();
    if (node) {
      this._previewerNodeStore.set(key, node as InlineStreamDiffHandler);
    }
  }

  tryRestoreState(monacoEditor: monaco.ICodeEditor, key: string) {
    const node = this.getStoredState(key);
    if (!node) {
      return;
    }

    if (node.disposed) {
      this.destroyPreviewer(key);
      return;
    }

    return this.restoreState(monacoEditor, node);
  }

  restoreState(monacoEditor: monaco.ICodeEditor, node: InlineStreamDiffHandler) {
    const uri = monacoEditor.getModel()?.uri;

    if (uri) {
      this.previewer = this.injector.get(LiveInlineDiffPreviewer, [monacoEditor]);
      this.previewer.attachNode(node);
      this.listenPreviewer(this.previewer);

      const dispose = this.previewer.onDispose(() => {
        this.destroyPreviewer();
        dispose.dispose();
      });
    }
  }

  registerInlineDiffFeature(editor: IEditor): IDisposable {
    const disposable = new Disposable();

    const monacoEditor = editor.monacoEditor;
    const model = monacoEditor.getModel();

    disposable.addDispose(
      monacoEditor.onWillChangeModel((e) => {
        if (!e.oldModelUrl) {
          return;
        }

        const urlString = e.oldModelUrl.toString();
        this.storeState(urlString);

        this.destroyPreviewer();
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

    if (model) {
      disposable.addDispose(
        model.onWillDispose(() => {
          const uriString = model.uri.toString();
          this.destroyPreviewer(uriString);
        }),
      );
    }

    return disposable;
  }

  showPreviewerByStream(
    monacoEditor: monaco.ICodeEditor,
    options: {
      crossSelection: monaco.Selection;
      chatResponse?: ChatResponse | InlineChatController;
      previewerOptions?: IDiffPreviewerOptions;
    },
  ): BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> {
    const { crossSelection, chatResponse } = options;

    const disposable = new Disposable();

    const previewer = this.createDiffPreviewer(monacoEditor, crossSelection, options.previewerOptions);

    const onFinish = () => {
      previewer.layout();
      disposable.dispose();
    };

    disposable.addDispose(
      previewer.onReady(() => {
        if (InlineChatController.is(chatResponse)) {
          const controller = chatResponse as InlineChatController;
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
        } else {
          previewer.setValue((chatResponse as ReplyResponse).message);
          onFinish();
        }
      }),
    );

    previewer.layout();
    return previewer;
  }

  createDiffPreviewer(monacoEditor: monaco.ICodeEditor, selection: monaco.Selection, options?: IDiffPreviewerOptions) {
    const inlineDiffMode = this.preferenceService.getValid<EInlineDiffPreviewMode>(
      AINativeSettingSectionsId.InlineDiffPreviewMode,
      EInlineDiffPreviewMode.inlineLive,
    );

    this.destroyPreviewer();

    if (inlineDiffMode === EInlineDiffPreviewMode.sideBySide) {
      this.previewer = this.injector.get(SideBySideInlineDiffWidget, [monacoEditor]);
    } else {
      this.previewer = this.injector.get(LiveInlineDiffPreviewer, [monacoEditor]);
    }

    this.previewer.create(selection, options);
    this.previewer.show(selection.startLineNumber - 1, selection.endLineNumber - selection.startLineNumber + 2);

    this.listenPreviewer(this.previewer);

    return this.previewer;
  }

  private listenPreviewer(previewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> | undefined) {
    if (!previewer) {
      return;
    }

    if (previewer instanceof LiveInlineDiffPreviewer) {
      previewer.addDispose(
        previewer.onPartialEditEvent!((event) => {
          this._onPartialEditEvent.fire(event);
        }),
      );
    }

    previewer.addDispose(previewer.onLineCount((lineCount) => this._onMaxLineCount.fire(lineCount)));
  }

  getPreviewer(): BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> | undefined {
    return this.previewer;
  }

  getStoredState(uri: string) {
    return this._previewerNodeStore.get(uri);
  }

  handleAction(action: EResultKind): void {
    this.previewer?.handleAction(action);
  }

  destroyPreviewer(uriString?: string) {
    this.previewer?.dispose();
    this.previewer = undefined;
    if (uriString) {
      this._previewerNodeStore.delete(uriString);
    }
  }

  revealFirstDiff() {
    this.previewer?.revealFirstDiff();
  }
}
