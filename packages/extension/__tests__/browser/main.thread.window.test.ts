import { Emitter } from '@opensumi/ide-core-common';
import { MainThreadIDEWindow } from '@opensumi/ide-extension/lib/browser/sumi/main.thread.window';
import { IWebviewService, IPlainWebviewWindow } from '@opensumi/ide-webview';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';


const onMessageEmitter = new Emitter<string>();
const onClosedEmitter = new Emitter<void>();
const mockWindow: IPlainWebviewWindow = {
  ready: Promise.resolve(),
  onMessage: onMessageEmitter.event,
  onClosed: onClosedEmitter.event,
  show: jest.fn(),
  hide: jest.fn(),
  setSize: jest.fn(),
  postMessage: jest.fn(),
  setAlwaysOnTop: jest.fn(),
  loadURL: jest.fn(),
  dispose: jest.fn(),
  url: '',
  webContentsId: 100,
  windowId: 99,
};

const mockWebviewService = {
  createWebviewWindow: jest.fn(() => mockWindow),
};

const mockExtThreadIDEWindowProxy = {
  $postMessage: jest.fn(),
  $dispatchClosed: jest.fn(),
};

let mainThreadIDEWindow: MainThreadIDEWindow;

const mockProxy = {
  getProxy: () => mockExtThreadIDEWindowProxy,
};

describe('MainThreadWindow API Test Suite', () => {
  const injector = createBrowserInjector(
    [],
    new MockInjector([
      {
        token: IWebviewService,
        useValue: mockWebviewService,
      },
    ]),
  );

  beforeAll(() => {
    mainThreadIDEWindow = injector.get(MainThreadIDEWindow, [mockProxy as any]);
  });

  it('should able to $createWebviewWindow', async () => {
    const webviewId = 'testView';
    const windowInfo = await mainThreadIDEWindow.$createWebviewWindow(webviewId, {}, { env: 'TEST' });
    expect(mockWebviewService.createWebviewWindow).toBeCalledTimes(1);
    onMessageEmitter.fire('message');
    expect(mockExtThreadIDEWindowProxy.$postMessage).toBeCalledWith(webviewId, 'message');
    expect(windowInfo.webContentsId).toBe(mockWindow.webContentsId);
    expect(windowInfo.windowId).toBe(mockWindow.windowId);
  });

  it('should able to $show', async () => {
    const webviewId = 'testView';
    mainThreadIDEWindow.$show(webviewId);
    expect(mockWindow.show).toBeCalledTimes(1);
  });

  it('should able to $hide', async () => {
    const webviewId = 'testView';
    mainThreadIDEWindow.$hide(webviewId);
    expect(mockWindow.hide).toBeCalledTimes(1);
  });

  it('should able to $setSize', async () => {
    const webviewId = 'testView';
    mainThreadIDEWindow.$setSize(webviewId, { width: 350, height: 750 });
    expect(mockWindow.setSize).toBeCalledTimes(1);
  });

  it('should able to $loadURI', async () => {
    const webviewId = 'testView';
    mainThreadIDEWindow.$loadURL(webviewId, 'http://opensumi.com');
    expect(mockWindow.loadURL).toBeCalledTimes(1);
  });

  it('should able to $postMessage', async () => {
    const webviewId = 'testView';
    mainThreadIDEWindow.$postMessage(webviewId, 'message');
    expect(mockWindow.postMessage).toBeCalledTimes(1);
  });

  it('should able to $setAlwaysOnTop', async () => {
    const webviewId = 'testView';
    mainThreadIDEWindow.$setAlwaysOnTop(webviewId, true);
    expect(mockWindow.setAlwaysOnTop).toBeCalledTimes(1);
  });

  it('should able to $destroy', async () => {
    const webviewId = 'testView';
    onClosedEmitter.fire();
    expect(mockExtThreadIDEWindowProxy.$dispatchClosed).toBeCalledWith(webviewId);
    expect(mockWindow.dispose).toBeCalledTimes(1);
  });
});
