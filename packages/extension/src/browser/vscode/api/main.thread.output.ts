import { Injectable, Autowired } from '@opensumi/di';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { OutputChannel } from '@opensumi/ide-output/lib/browser/output.channel';
import { OutputService } from '@opensumi/ide-output/lib/browser/output.service';

import { IMainThreadOutput } from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadOutput implements IMainThreadOutput {
  @Autowired(OutputService)
  private outputService: OutputService;

  private channels: Map<string, OutputChannel> = new Map();

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  public dispose() {
    this.channels.forEach((channel) => {
      this.outputService.deleteChannel(channel.name);
    });
    this.channels.clear();
  }

  $append(channelName: string, value: string): PromiseLike<void> {
    const outputChannel = this.getChannel(channelName);
    if (outputChannel) {
      outputChannel.append(value);
    }

    return Promise.resolve();
  }

  $clear(channelName: string): PromiseLike<void> {
    const outputChannel = this.getChannel(channelName);
    if (outputChannel) {
      outputChannel.clear();
    }

    return Promise.resolve();
  }

  $dispose(channelName: string): PromiseLike<void> {
    this.outputService.deleteChannel(channelName);
    if (this.channels.has(channelName)) {
      this.channels.delete(channelName);
    }

    return Promise.resolve();
  }

  async $reveal(channelName: string, preserveFocus: boolean): Promise<void> {
    const outputChannel = this.getChannel(channelName);
    if (outputChannel) {
      outputChannel.setVisibility(true);
      this.outputService.updateSelectedChannel(outputChannel);
    }
  }

  $close(channelName: string): PromiseLike<void> {
    const outputChannel = this.getChannel(channelName);
    if (outputChannel) {
      outputChannel.setVisibility(false);
    }
    return Promise.resolve();
  }

  private getChannel(channelName: string): OutputChannel | undefined {
    let outputChannel: OutputChannel | undefined;
    if (this.channels.has(channelName)) {
      outputChannel = this.channels.get(channelName);
    } else {
      outputChannel = this.outputService.getChannel(channelName);
      this.channels.set(channelName, outputChannel);
    }

    return outputChannel;
  }
}
