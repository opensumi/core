const maxChannelHistory = 1000;

export class OutputChannel {

    // private readonly visibilityChangeEmitter = new Emitter<{visible: boolean}>();
    // private readonly contentChangeEmitter = new Emitter<OutputChannel>();
    private lines: string[] = [];
    private currentLine: string | undefined;
    private visible: boolean = true;

    // readonly onVisibilityChange: Event<{visible: boolean}> = this.visibilityChangeEmitter.event;
    // readonly onContentChange: Event<OutputChannel> = this.contentChangeEmitter.event;

    constructor(readonly name: string) { }

    append(value: string): void {
        if (this.currentLine === undefined) {
            this.currentLine = value;
        } else {
            this.currentLine += value;
        }
        // this.contentChangeEmitter.fire(this);
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
    }

    clear(): void {
        this.lines.length = 0;
        this.currentLine = undefined;
        // this.contentChangeEmitter.fire(this);
    }

    setVisibility(visible: boolean): void {
        this.visible = visible;
        // this.visibilityChangeEmitter.fire({visible});
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
