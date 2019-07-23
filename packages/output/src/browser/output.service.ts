import { Injectable, Autowired } from '@ali/common-di';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { OnEvent } from '@ali/ide-core-common';
import { ResizeEvent } from '@ali/ide-main-layout';
import { getSlotLocation, AppConfig } from '@ali/ide-core-browser';
import { OutputChannel } from '../common/output.channel';
const pkgName = require('../../package.json').name;

@Injectable()
export class OutputService extends Themable {

  @Autowired(AppConfig)
  private config: AppConfig;

  windowOutputResizeId: NodeJS.Timeout;

  protected readonly channels = new Map<string, OutputChannel>();

  // private readonly channelDeleteEmitter = new Emitter<{channelName: string}>();
  // private readonly channelAddedEmitter = new Emitter<OutputChannel>();
  // readonly onChannelDelete = this.channelDeleteEmitter.event;
  // readonly onChannelAdded = this.channelAddedEmitter.event;

  constructor() {
    super();
  }

  getChannel(name: string): OutputChannel {
      const existing = this.channels.get(name);
      if (existing) {
          return existing;
      }
      const channel = new OutputChannel(name);
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
  initOutput(outputContainerEl: HTMLElement) {
  }

  @OnEvent(ResizeEvent)
  onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === getSlotLocation(pkgName, this.config.layoutConfig)) {
      clearTimeout(this.windowOutputResizeId);
      this.windowOutputResizeId = setTimeout(() => {
      }, 20);
    }
  }

}
