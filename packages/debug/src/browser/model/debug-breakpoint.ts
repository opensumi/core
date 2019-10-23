import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { DebugSession } from '../debug-session';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { BreakpointManager } from '../breakpoint';
import { URI, IRange, localize } from '@ali/ide-core-browser';
import { DebugSource } from './debug-source';
import { WorkbenchEditorService, IResourceOpenOptions } from '@ali/ide-editor';
import { DebugModel } from '../editor/debug-model';

export class DebugBreakpointData {
  readonly raw?: DebugProtocol.Breakpoint;
  readonly origins: SourceBreakpoint[];
}

export class DebugBreakpointDecoration {
  readonly className: string;
  readonly message: string[];
}

export class DebugBreakpoint extends DebugBreakpointData {
  readonly uri: URI;

  constructor(
    origin: SourceBreakpoint,
    protected readonly labelProvider: LabelService,
    protected readonly breakpoints: BreakpointManager,
    protected readonly workbenchEditorService: WorkbenchEditorService,
    protected readonly session?: DebugSession,
  ) {
    super();
    Object.assign(this, { origins: [origin] });
    this.uri = new URI(this.origins[0].uri);
  }
  update(data: Partial<DebugBreakpointData>): void {
    Object.assign(this, data);
  }

  get origin(): SourceBreakpoint {
    return this.origins[0];
  }

  get id(): string {
    return this.origin.id;
  }

  get idFromAdapter(): number | undefined {
    return this.raw && this.raw.id;
  }

  get enabled(): boolean {
    return this.breakpoints.breakpointsEnabled && this.origin.enabled;
  }
  setEnabled(enabled: boolean): void {
    const { uri, raw } = this;
    let shouldUpdate = false;
    let breakpoints = raw && this.doRemove(this.origins.filter((origin) => origin.raw.line !== raw.line));
    if (breakpoints) {
      shouldUpdate = true;
    } else {
      breakpoints = this.breakpoints.getBreakpoints(uri);
    }
    for (const breakpoint of breakpoints) {
      if (breakpoint.raw.line === this.origin.raw.line && breakpoint.enabled !== enabled) {
        breakpoint.enabled = enabled;
        shouldUpdate = true;
      }
    }
    if (shouldUpdate) {
      this.breakpoints.setBreakpoints(this.uri, breakpoints);
    }
  }

  updateOrigins(data: Partial<DebugProtocol.SourceBreakpoint>): void {
    const breakpoints = this.breakpoints.getBreakpoints(this.uri);
    let shouldUpdate = false;
    const originLines = new Set();
    this.origins.forEach((origin) => originLines.add(origin.raw.line));
    for (const breakpoint of breakpoints) {
      if (originLines.has(breakpoint.raw.line)) {
        Object.assign(breakpoint.raw, data);
        shouldUpdate = true;
      }
    }
    if (shouldUpdate) {
      this.breakpoints.setBreakpoints(this.uri, breakpoints);
    }
  }

  get installed(): boolean {
    return !!this.raw;
  }

  get verified(): boolean {
    return !!this.raw ? this.raw.verified : true;
  }
  get message(): string {
    return this.raw && this.raw.message || '';
  }

  /** 1-based */
  get line(): number {
    return this.raw && this.raw.line || this.origins[0].raw.line;
  }
  get column(): number | undefined {
    return this.raw && this.raw.column || this.origins[0].raw.column;
  }
  get endLine(): number | undefined {
    return this.raw && this.raw.endLine;
  }
  get endColumn(): number | undefined {
    return this.raw && this.raw.endColumn;
  }

  get condition(): string | undefined {
    return this.origin.raw.condition;
  }
  get hitCondition(): string | undefined {
    return this.origin.raw.hitCondition;
  }
  get logMessage(): string | undefined {
    return this.origin.raw.logMessage;
  }

  get source(): DebugSource | undefined {
    return this.raw && this.raw.source && this.session && this.session.getSource(this.raw.source);
  }

  protected readonly setBreakpointEnabled = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setEnabled(event.target.checked);
  }

  remove(): void {
    const breakpoints = this.doRemove(this.origins);
    if (breakpoints) {
      this.breakpoints.setBreakpoints(this.uri, breakpoints);
    }
  }

  protected doRemove(origins: SourceBreakpoint[]): SourceBreakpoint[] | undefined {
    if (!origins.length) {
      return undefined;
    }
    const { uri } = this;
    const toRemove = new Set();
    origins.forEach((origin) => toRemove.add(origin.raw.line));
    let shouldUpdate = false;
    const breakpoints = this.breakpoints.findMarkers({
      uri,
      dataFilter: (data) => {
        const result = !toRemove.has(data.raw.line);
        shouldUpdate = shouldUpdate || !result;
        return result;
      },
    }).map(({ data }) => data);
    return shouldUpdate && breakpoints || undefined;
  }

  async open(options: IResourceOpenOptions): Promise<void> {
    const { line, column, endLine, endColumn, condition } = this;
    const range: IRange = {
      startLineNumber: line,
      startColumn: typeof column === 'number' ? column : 0,
      endLineNumber: typeof endLine === 'number' ? endLine : line,
      endColumn: typeof endColumn === 'number' ? endColumn : (column ? column : 0) + (condition ? condition.length : 0),
    };

    if (this.source) {
      await this.source.open({
        ...options,
        range,
      });
    } else {
      // if (this.models) {
      //   for (const model of this.models) {
      //     model.render();
      //   }
      // }
      await this.workbenchEditorService.open(this.uri, {
        ...options,
        range,
      });
    }
  }

  protected getDisabledBreakpointDecoration(): DebugBreakpointDecoration {
    const decoration = this.getBreakpointDecoration();
    return {
      className: decoration.className + '-disabled',
      message: [localize('debug.breakpoint.disabled') + decoration.message[0]],
    };
  }

  protected getBreakpointDecoration(message?: string[]): DebugBreakpointDecoration {
    if (this.logMessage) {
      return {
        className: 'kaitian-debug-logpoint',
        message: message || [localize('debug.breakpoint.logpointMessage')],
      };
    }
    if (this.condition || this.hitCondition) {
      return {
        className: 'kaitian-debug-conditional-breakpoint',
        message: message || [localize('debug.breakpoint.conditionalMessage')],
      };
    }
    return {
      className: 'kaitian-debug-breakpoint',
      message: message || [localize('debug.breakpoint.breakpointMessage')],
    };
  }

  getDecoration(): DebugBreakpointDecoration {
    if (!this.enabled) {
      return this.getDisabledBreakpointDecoration();
    }
    if (this.installed && !this.verified) {
      return this.getUnverifiedBreakpointDecoration();
    }
    // TODO: hitcount, logpoint, expression 支持
    return this.getBreakpointDecoration();
  }

  protected getUnverifiedBreakpointDecoration(): DebugBreakpointDecoration {
    const decoration = this.getBreakpointDecoration();
    return {
      className: decoration.className + '-unverified',
      message: [this.message || localize('debug.breakpoint.unverified') + decoration.message[0]],
    };
  }
}
