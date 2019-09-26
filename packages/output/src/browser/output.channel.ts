import { IEventBus, BasicEvent } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';

const maxChannelHistory = 1000;

export class ContentChangePayload {}

export class ContentChangeEvent extends BasicEvent<ContentChangePayload> {}

@Injectable({multiple: true})
export class OutputChannel {

    // private readonly visibilityChangeEmitter = new Emitter<{visible: boolean}>();
    // private readonly contentChangeEmitter = new Emitter<OutputChannel>();
    private lines: string[] = [];
    private currentLine: string | undefined;
    private visible: boolean = true;

    @Autowired(IMainLayoutService)
    layoutService: IMainLayoutService;

    // readonly onVisibilityChange: Event<{visible: boolean}> = this.visibilityChangeEmitter.event;
    // readonly onContentChange: Event<OutputChannel> = this.contentChangeEmitter.event;

    constructor(readonly name: string) {
    }

    @Autowired(IEventBus)
    private eventBus: IEventBus;

    append(value: string): void {
        if (this.currentLine === undefined) {
            this.currentLine = value;
        } else {
            this.currentLine += value;
        }
        // this.contentChangeEmitter.fire(this);
        this.eventBus.fire(new ContentChangeEvent(new ContentChangePayload()));
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
        // this.contentChangeEmitter.fire(this);
        this.eventBus.fire(new ContentChangeEvent(new ContentChangePayload()));
    }

    clear(): void {
        this.lines.length = 0;
        this.currentLine = undefined;
        // this.contentChangeEmitter.fire(this);
        this.eventBus.fire(new ContentChangeEvent(new ContentChangePayload()));
    }

    setVisibility(visible: boolean): void {
        this.visible = visible;
        // this.visibilityChangeEmitter.fire({visible});

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

    get getLines(): string[] {
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
