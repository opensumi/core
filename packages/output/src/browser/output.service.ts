import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { OnEvent, WithEventBus } from '@ali/ide-core-common';
import { AppConfig } from '@ali/ide-core-browser';

import { OutputChannel } from './output.channel';
import { ContentChangeEvent } from '../common';

@Injectable()
export class OutputService extends WithEventBus {

  @Autowired(AppConfig)
  private config: AppConfig;

  @observable
  readonly channels = new Map<string, OutputChannel>();

  @observable.ref
  selectedChannel: OutputChannel;

  @observable
  public keys: string = '' + Math.random();

  constructor() {
    super();
  }

  @observable
  private _viewHeight: string;

  set viewHeight(value: string) {
    this._viewHeight = value;
  }

  get viewHeight() {
    return this._viewHeight;
  }

  getChannel(name: string): OutputChannel {
    const existing = this.channels.get(name);
    if (existing) {
      return existing;
    }
    const channel = this.config.injector.get(OutputChannel, [name]);
    this.channels.set(name, channel);
    return channel;
  }

  deleteChannel(name: string): void {
    this.channels.delete(name);
  }

  getChannels(): OutputChannel[] {
    return Array.from(this.channels.values());
  }

  @OnEvent(ContentChangeEvent)
  OnContentChange() {
    this.keys = '' + Math.random();
  }
}
