import { observable, computed } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { OnEvent, EventBusImpl, IEventBus } from '@ali/ide-core-common';
import { getSlotLocation, AppConfig, ResizeEvent } from '@ali/ide-core-browser';
import { OutputChannel } from './output.channel';
import { ContentChangeEvent } from '../common';
const pkgName = require('../../package.json').name;

@Injectable()
export class OutputService extends Themable {

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

  getChannel(name: string): OutputChannel {
      const existing = this.channels.get(name);
      if (existing) {
          return existing;
      }
      const channel = this.config.injector.get(OutputChannel, [name]);
      this.channels.set(name, channel);
      // this.channelAddedEmitter.fire(channel);
      return channel;
  }

  deleteChannel(name: string): void {
      this.channels.delete(name);
      // this.channelDeleteEmitter.fire({channelName: name});
  }

  getChannels(): OutputChannel[] {
      return Array.from(this.channels.values());
  }

  @OnEvent(ContentChangeEvent)
  OnContentChange(e: ContentChangeEvent) {
    this.keys = '' + Math.random();
  }

}
