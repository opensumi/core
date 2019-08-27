import { Injectable, Autowired } from '@ali/common-di';
import { DebugSession } from './debug-session';
import { IWaitUntil, URI, Emitter, Event, IContextKey } from '@ali/ide-core-browser';
import { MonacoContextKeyService } from '@ali/ide-monaco/lib/browser/monaco.context-key.service';

// tslint:disable-next-line:no-empty-interface
export interface WillStartDebugSession extends IWaitUntil {
}

export interface WillResolveDebugConfiguration extends IWaitUntil {
    debugType: string;
}

export interface DidChangeActiveDebugSession {
    previous: DebugSession | undefined;
    current: DebugSession | undefined;
}

export interface DidChangeBreakpointsEvent {
    session?: DebugSession;
    uri: URI;
}

export interface DebugSessionCustomEvent {
    readonly body?: any;
    readonly event: string;
    readonly session: DebugSession;
}

@Injectable()
export class DebugSessionManager {
  protected readonly _sessions = new Map<string, DebugSession>();

  protected readonly onWillStartDebugSessionEmitter = new Emitter<WillStartDebugSession>();
  readonly onWillStartDebugSession: Event<WillStartDebugSession> = this.onWillStartDebugSessionEmitter.event;

  protected readonly onWillResolveDebugConfigurationEmitter = new Emitter<WillResolveDebugConfiguration>();
  readonly onWillResolveDebugConfiguration: Event<WillResolveDebugConfiguration> = this.onWillResolveDebugConfigurationEmitter.event;

  protected readonly onDidCreateDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidCreateDebugSession: Event<DebugSession> = this.onDidCreateDebugSessionEmitter.event;

  protected readonly onDidStartDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidStartDebugSession: Event<DebugSession> = this.onDidStartDebugSessionEmitter.event;

  protected readonly onDidStopDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidStopDebugSession: Event<DebugSession> = this.onDidStopDebugSessionEmitter.event;

  protected readonly onDidChangeActiveDebugSessionEmitter = new Emitter<DidChangeActiveDebugSession>();
  readonly onDidChangeActiveDebugSession: Event<DidChangeActiveDebugSession> = this.onDidChangeActiveDebugSessionEmitter.event;

  protected readonly onDidDestroyDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidDestroyDebugSession: Event<DebugSession> = this.onDidDestroyDebugSessionEmitter.event;

  protected readonly onDidReceiveDebugSessionCustomEventEmitter = new Emitter<DebugSessionCustomEvent>();
  readonly onDidReceiveDebugSessionCustomEvent: Event<DebugSessionCustomEvent> = this.onDidReceiveDebugSessionCustomEventEmitter.event;

  protected readonly onDidChangeBreakpointsEmitter = new Emitter<DidChangeBreakpointsEvent>();
  readonly onDidChangeBreakpoints: Event<DidChangeBreakpointsEvent> = this.onDidChangeBreakpointsEmitter.event;
  protected fireDidChangeBreakpoints(event: DidChangeBreakpointsEvent): void {
      this.onDidChangeBreakpointsEmitter.fire(event);
  }

  protected readonly onDidChangeEmitter = new Emitter<DebugSession | undefined>();
  readonly onDidChange: Event<DebugSession | undefined> = this.onDidChangeEmitter.event;
  protected fireDidChange(current: DebugSession | undefined): void {
    this.inDebugModeKey.set(this.inDebugMode);
    this.onDidChangeEmitter.fire(current);
  }

  protected debugTypeKey: IContextKey<string>;
  protected inDebugModeKey: IContextKey<boolean>;

  @Autowired(MonacoContextKeyService)
  contextKeyService: MonacoContextKeyService;

  constructor() {
    this.init();
  }

  protected init(): void {
    this.debugTypeKey = this.contextKeyService.createKey<string>('debugType', undefined);
    this.inDebugModeKey = this.contextKeyService.createKey<boolean>('inDebugMode', this.inDebugMode);
    this.breakpoints.onDidChangeMarkers((uri) => this.fireDidChangeBreakpoints({ uri }));
  }
}
