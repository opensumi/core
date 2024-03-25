import { action, makeObservable, observable } from 'mobx';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, WithEventBus } from '@opensumi/ide-core-common';
import {
  EditorCollectionService,
  ICodeEditor,
  IEditorDocumentModelService,
  getSimpleEditorOptions,
} from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';

import { OutputChannel } from './output.channel';

@Injectable()
export class OutputService extends WithEventBus {
  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(EditorCollectionService)
  private readonly editorCollectionService: EditorCollectionService;

  @Autowired(IEditorDocumentModelService)
  protected readonly documentService: IEditorDocumentModelService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private outputEditor?: ICodeEditor;

  @observable.shallow
  readonly channels = observable.map<string, OutputChannel>();

  public selectedChannel: OutputChannel;
  private onDidSelectedChannelChangeEmitter = new Emitter<OutputChannel>();

  @observable
  public keys: string = '' + Math.random();

  private monacoDispose: monaco.IDisposable;

  private autoReveal = true;

  private enableSmartScroll = true;

  get onDidSelectedChannelChange() {
    return this.onDidSelectedChannelChangeEmitter.event;
  }

  constructor() {
    super();
    makeObservable(this);
    this.enableSmartScroll = Boolean(this.preferenceService.get<boolean>('output.enableSmartScroll'));
    this.addDispose(
      this.preferenceService.onPreferenceChanged((e) => {
        if (e.preferenceName === 'output.enableSmartScroll' && e.newValue !== this.enableSmartScroll) {
          this.enableSmartScroll = e.newValue;
        }
      }),
    );
  }

  public updateSelectedChannel(channel: OutputChannel) {
    if (this.monacoDispose) {
      this.monacoDispose.dispose();
    }
    this.selectedChannel = channel;
    this.onDidSelectedChannelChangeEmitter.fire(channel);
    this.selectedChannel.modelReady.promise.then(() => {
      const model = this.selectedChannel.outputModel.instance.getMonacoModel();
      this.outputEditor?.open(this.selectedChannel.outputModel);
      if (this.enableSmartScroll) {
        this.outputEditor?.monacoEditor.revealLine(model.getLineCount());
        this.autoReveal = true;
      }

      this.monacoDispose = model.onDidChangeContent(() => {
        if (this.autoReveal && this.enableSmartScroll) {
          this.outputEditor?.monacoEditor.revealLine(model.getLineCount(), 0);
        }
      });
    });
  }

  @observable
  private _viewHeight: string;

  set viewHeight(value: string) {
    this._viewHeight = value;
  }

  get viewHeight() {
    return this._viewHeight;
  }

  @action
  getChannel(name: string): OutputChannel {
    const existing = this.channels.get(name);
    if (existing) {
      return existing;
    }
    const channel = this.config.injector.get(OutputChannel, [name]);
    this.channels.set(name, channel);
    if (this.channels.size === 1) {
      this.updateSelectedChannel(channel);
    }
    return channel;
  }

  @action
  deleteChannel(name: string): void {
    this.channels.delete(name);
  }

  getChannels(): OutputChannel[] {
    return Array.from(this.channels.values());
  }

  public async initOutputMonacoInstance(container: HTMLDivElement) {
    if (this.outputEditor) {
      this.outputEditor.dispose();
    }

    this.outputEditor = this.editorCollectionService.createCodeEditor(container, {
      ...getSimpleEditorOptions(),
      lineDecorationsWidth: 20,
      automaticLayout: true,
      readOnly: true,
      extraEditorClassName: 'kt-output-monaco',
      scrollbar: {
        useShadows: false,
      },
    });

    if (this.selectedChannel) {
      this.updateSelectedChannel(this.selectedChannel);
    }

    this.addDispose(
      this.outputEditor.monacoEditor.onMouseUp((e) => {
        /**
         * 这里的逻辑是
         * 当开启智能滚动后，如果鼠标事件点击所在行小于当前总行数，则停止自动滚动
         * 如果点击到最后一行，则启用自动滚动
         */
        if (this.enableSmartScroll) {
          const { range } = e.target;
          const maxLine = this.outputEditor?.currentDocumentModel?.getMonacoModel().getLineCount();
          if (range?.startLineNumber! < maxLine!) {
            this.autoReveal = false;
          }
          if (range?.startLineNumber! >= maxLine!) {
            this.autoReveal = true;
          }
        }
      }),
    );
  }
}
