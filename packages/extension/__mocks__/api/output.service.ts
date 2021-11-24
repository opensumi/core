import { Injectable } from '@opensumi/common-di';
import { getDebugLogger } from '@opensumi/ide-core-common';

const maxChannelHistory = 1000;

export class MockOutputChannel {
  private lines: string[] = [];
  private currentLine: string | undefined;
  private visible: boolean = true;
  private shouldLogToBrowser = false;

  constructor(public readonly name: string) {
  }

  append(value: string): void {
    this.lines.push(value);
    if (this.shouldLogToBrowser) {
      getDebugLogger().log(`%c[${this.name}]` + `%c ${value}`, 'background:rgb(50, 150, 250); color: #fff', 'background: none; color: inherit');
    }
  }

  appendLine(line: string): void {
    if (this.currentLine !== undefined) {
      this.lines.push(this.currentLine + line);
      this.currentLine = undefined;
    } else {
      this.lines.push(line);
    }
    if (this.lines.length > maxChannelHistory) {
      this.lines.splice(0, this.lines.length - maxChannelHistory);
    }
    if (this.shouldLogToBrowser) {
      getDebugLogger().log(`%c[${this.name}]` + `%c ${line}}`, 'background:rgb(50, 150, 250); color: #fff', 'background: none; color: inherit');
    }
  }

  clear(): void {
    this.lines.length = 0;
    this.currentLine = undefined;
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
  }

  getLines(): string[] {
    return this.lines;
  }

  get isVisible(): boolean {
    return this.visible;
  }
}

@Injectable()
export class MockOutputService {
  public channels: Map<string, MockOutputChannel> = new Map();
  constructor() {
  }

  getChannel(name: string): MockOutputChannel {
    const existing = this.channels.get(name);
    if (existing) {
      return existing;
    }
    const channel = new MockOutputChannel(name);
    this.channels.set(name, channel);
    return channel;
  }

  deleteChannel(name: string): void {
    this.channels.delete(name);
  }

  getChannels(): MockOutputChannel[] {
    return Array.from(this.channels.values());
  }
}
