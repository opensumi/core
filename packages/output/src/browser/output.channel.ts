import { Event, Disposable, IEventBus } from '@ali/ide-core-common';
import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { PreferenceService } from '@ali/ide-core-browser';

import { ContentChangeEvent, ContentChangeEventPayload, ContentChangeType } from '../common';
import { OutputPreferences } from './output-preference';

const maxChannelHistory = 1000;

@Injectable({ multiple: true })
export class OutputChannel extends Disposable {
  private lines: string[] = [];
  private currentLine: string | undefined;
  private visible: boolean = true;
  private shouldLogToBrowser = false;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(OutputPreferences)
  private readonly outputPreferences: OutputPreferences;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  constructor(@Optional() public readonly name: string) {
    super();

    this.setShouldLogToBrowser();
    this.addDispose(Event.debounce(
      this.preferenceService.onPreferenceChanged,
      (last, event) => last || event.preferenceName === 'output.logWhenNoPanel',
      50,
    )(this.setShouldLogToBrowser, this));
  }

  private setShouldLogToBrowser() {
    const noVisiblePanel = !this.layoutService.getTabbarHandler('ide-output');
    const logWhenNoPanel = this.outputPreferences['output.logWhenNoPanel'];
    this.shouldLogToBrowser = Boolean(noVisiblePanel && logWhenNoPanel);
  }

  append(value: string): void {
    if (this.currentLine === undefined) {
      this.currentLine = value;
    } else {
      this.currentLine += value;
    }
    this.eventBus.fire(new ContentChangeEvent(new ContentChangeEventPayload(this.name, ContentChangeType.append, value, this.getLines())));
    if (this.shouldLogToBrowser) {
      console.log(`%c[${this.name}]` + `%c ${value}`, 'background:rgb(50, 150, 250); color: #fff', 'background: none; color: inherit');
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
    this.eventBus.fire(new ContentChangeEvent(new ContentChangeEventPayload(this.name, ContentChangeType.appendLine, line, this.getLines())));
    if (this.shouldLogToBrowser) {
      console.log(`%c[${this.name}]` + `%c ${line}}`, 'background:rgb(50, 150, 250); color: #fff', 'background: none; color: inherit');
    }
  }

  clear(): void {
    this.lines.length = 0;
    this.currentLine = undefined;
    this.eventBus.fire(new ContentChangeEvent(new ContentChangeEventPayload(this.name, ContentChangeType.appendLine, '', this.getLines())));
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;

    if (visible) {
      const handler = this.layoutService.getTabbarHandler('ide-output');
      if (!handler) {
        return;
      }
      if (!handler.isVisible) {
        handler.activate();
      }
    }
  }

  getLines(): string[] {
    if (this.currentLine !== undefined) {
      return [...this.lines, this.currentLine];
    } else {
      return this.lines;
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
