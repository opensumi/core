import WebSocket from 'ws';
import { Terminal } from 'xterm';
import { uuid, URI, Emitter, IDisposable, PreferenceScope } from '@opensumi/ide-core-common';
import { OS } from '@opensumi/ide-core-common/lib/platform';
import { Disposable, PreferenceProvider, PreferenceResolveResult } from '@opensumi/ide-core-browser';
import {
  ITerminalService,
  ITerminalConnection,
  ITerminalError,
  IShellLaunchConfig,
  ITerminalProfile,
  ITerminalProfileService,
  IResolveDefaultProfileOptions,
  ITerminalProfileProvider,
} from '../../src/common';
import { getPort, localhost, MessageMethod } from './proxy';
import { delay } from './utils';
import { PreferenceService } from '@opensumi/ide-core-browser';
// Ref: https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

export const defaultName = 'bash';

export class MockSocketService implements ITerminalService {
  static resId = 1;

  private _socks: Map<string, WebSocket>;
  private _response: Map<number, { resolve: (value: any) => void }>;

  constructor() {
    this._socks = new Map();
    this._response = new Map();
  }
  async attachByLaunchConfig(
    sessionId: string,
    cols: number,
    rows: number,
    launchConfig: IShellLaunchConfig,
  ): Promise<ITerminalConnection | undefined> {
    const sock = new WebSocket(localhost(getPort()));
    this._socks.set(sessionId, sock);

    await delay(1000);

    this._handleMethod(sessionId);

    await this._doMethod(sessionId, MessageMethod.create, { sessionId, cols, rows });

    return this._customConnection(sessionId);
  }

  async getProfiles(_: boolean): Promise<ITerminalProfile[]> {
    return [
      {
        profileName: 'bash',
        path: '/bin/bash',
        isDefault: true,
      },
    ];
  }
  async getDefaultSystemShell(): Promise<string> {
    return (await this.getProfiles(true))[0].path;
  }
  getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    return Promise.resolve('osx');
  }

  makeId() {
    return uuid();
  }

  meta() {
    return '';
  }

  restore() {
    return 'term.test.restore';
  }

  getOptions() {
    return {};
  }

  async getOs() {
    return OS;
  }

  private _handleStdoutMessage(sessionId: string, handler: (json: any) => void) {
    const socket = this._socks.get(sessionId);
    if (!socket) {
      return;
    }
    socket.addEventListener('message', ({ data }) => {
      const json = JSON.parse(data) as any;
      if (!json.method) {
        handler(json.data);
      }
    });
  }

  private _customConnection(sessionId: string): ITerminalConnection {
    return {
      onData: (handler: (json: any) => void) => {
        this._handleStdoutMessage(sessionId, handler);
        return {
          dispose: () => {},
        };
      },
      sendData: (message: string) => {
        if (!message) {
          return;
        }
        this._sendMessage(sessionId, {
          sessionId,
          data: message,
        });
      },
      name: defaultName,
      readonly: false,
    };
  }

  private _sendMessage(sessionId: string, json: any) {
    const sock = this._socks.get(sessionId);
    if (!sock) {
      return;
    }
    sock.send(JSON.stringify(json));
  }

  private async _doMethod(sessionId: string, method: string, params: any) {
    return new Promise((resolve) => {
      const id = MockSocketService.resId++;
      this._sendMessage(sessionId, { id, method, params });
      if (id !== -1) {
        this._response.set(id, { resolve });
      }
    });
  }

  private _handleMethod(sessionId: string) {
    const socket = this._socks.get(sessionId);

    if (!socket) {
      return;
    }

    const handleSocketMessage = (msg: MessageEvent) => {
      const json = JSON.parse(msg.data);
      if (json.method) {
        const handler = this._response.get(json.id);
        handler && handler.resolve(json);
        this._response.delete(json.id);
      }
    };

    socket.addEventListener('message', handleSocketMessage as any);
  }

  async attach(sessionId: string, term: Terminal) {
    return this.attachByLaunchConfig(sessionId, term.cols, term.rows, {});
  }

  async sendText(sessionId: string, data: string) {
    this._sendMessage(sessionId, { sessionId, data });
  }

  async resize(sessionId: string, cols: number, rows: number) {
    await this._doMethod(sessionId, MessageMethod.resize, { cols, rows });
    return;
  }

  disposeById(sessionId: string) {
    const socket = this._socks.get(sessionId);

    this._doMethod(sessionId, MessageMethod.resize, { id: sessionId });

    if (socket) {
      try {
        socket.close();
      } catch {
        /** nothing */
      }
    }
  }

  async getProcessId() {
    return -1;
  }

  onError() {
    return new Disposable();
  }
  onExit() {
    return new Disposable();
  }
}

export class MockEditorService {}

export class MockFileService {
  getFileStat(uri: URI) {
    return Promise.resolve({});
  }
}

/** Mock MainLayout Service */
export const MainLayoutTabbarOnActivate = new Emitter<any>();
export const MainLayoutTabbarOnInActivate = new Emitter<any>();

export class MockMainLayoutService {
  getTabbarHandler() {
    return {
      onActivate: MainLayoutTabbarOnActivate.event,
      onInActivate: MainLayoutTabbarOnInActivate.event,
      isActivated: () => true,
    };
  }

  toggleSlot() {
    // todo
  }
}
/** End */

/** Mock Theme Service */
export const MainTerminalThemeOnThemeChange = new Emitter<any>();

export class MockThemeService {
  onThemeChange = MainTerminalThemeOnThemeChange.event;
}
/** End */

/** Mock Terminal Theme Service */
export class MockTerminalThemeService {
  get terminalTheme() {
    return {
      background: 'white',
    };
  }
}
/** End */

/** Mock Preference Service */
export class MockPreferenceService implements PreferenceService {
  ready: Promise<void> = Promise.resolve();
  hasLanguageSpecific(preferenceName: any, overrideIdentifier: string, resourceUri: string): boolean {
    return false;
  }
  async set(
    preferenceName: string,
    value: any,
    scope?: PreferenceScope,
    resourceUri?: string,
    overrideIdentifier?: string,
  ): Promise<void> {}
  onPreferencesChanged() {
    return Disposable.NULL;
  }
  onLanguagePreferencesChanged() {
    return Disposable.NULL;
  }
  inspect<T>(
    preferenceName: string,
    resourceUri?: string,
    language?: string,
  ):
    | {
        preferenceName: string;
        defaultValue: T | undefined;
        globalValue: T | undefined;
        workspaceValue: T | undefined;
        workspaceFolderValue: T | undefined;
      }
    | undefined {
    return;
  }
  getProvider(scope: PreferenceScope): PreferenceProvider | undefined {
    return;
  }
  resolve<T>(
    preferenceName: string,
    defaultValue?: T,
    resourceUri?: string,
    language?: string,
    untilScope?: PreferenceScope,
  ): PreferenceResolveResult<T> {
    throw new Error('Method not implemented.');
  }
  onSpecificPreferenceChange() {
    return Disposable.NULL;
  }
  dispose(): void {}
  get(key: string, defaultValue?: any) {
    return defaultValue;
  }
  onPreferenceChanged() {
    return new Disposable();
  }
}
/** End */

/** Mock Terminal Widget */
export class MockTerminalWidget {
  resize() {
    // todo
  }
}
/** End */

/** Mock Error Service */
export class MockErrorService {
  errors = new Map<string, ITerminalError>();

  async fix(_sessionId: string) {}
}
/** End */

export class MockProfileService implements ITerminalProfileService {
  availableProfiles: ITerminalProfile[] = [
    {
      isDefault: true,
      path: '/bin/sh',
      profileName: 'default',
    },
  ];
  getDefaultProfileName(): string | undefined {
    return 'default';
  }
  profilesReady: Promise<void> = Promise.resolve();
  refreshAvailableProfiles(): void {
    return;
  }
  onDidChangeAvailableProfiles() {
    return new Disposable();
  }
  getContributedProfileProvider(extensionIdentifier: string, id: string): ITerminalProfileProvider | undefined {
    return;
  }
  registerTerminalProfileProvider(
    extensionIdentifier: string,
    id: string,
    profileProvider: ITerminalProfileProvider,
  ): IDisposable {
    return new Disposable();
  }
  resolveDefaultProfile(options?: IResolveDefaultProfileOptions): Promise<ITerminalProfile | undefined> {
    return Promise.resolve(this.availableProfiles[0]);
  }
  resolveRealDefaultProfile(): Promise<ITerminalProfile | undefined> {
    return this.resolveDefaultProfile();
  }
}
