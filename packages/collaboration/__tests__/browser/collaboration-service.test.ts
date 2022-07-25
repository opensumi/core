/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Y from 'yjs';

import { Injectable } from '@opensumi/di';
import { FilesChangeEvent } from '@opensumi/ide-core-browser';
import { EventBusImpl, FileChangeType, IEventBus, ILogger, URI } from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorActiveResourceStateChangedEvent, EditorGroupCloseEvent } from '@opensumi/ide-editor/lib/browser';
import { IFileService } from '@opensumi/ide-file-service';
import { ITextModel } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { createModel } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneEditor';

import { CollaborationServiceForClientPath, ICollaborationService, IYWebsocketServer } from '../../src';
import { CollaborationService } from '../../src/browser/collaboration.service';
import { TextModelBinding } from '../../src/browser/textmodel-binding';
import { CollaborationServiceForClient } from '../../src/node/collaboration.service';
import { YWebsocketServerImpl } from '../../src/node/y-websocket-server';

@Injectable()
class MockWorkbenchEditorService {
  uri: URI;

  currentResource: { uri: URI };

  currentCodeEditor: {
    currentDocumentModel: { getText: () => string; getMonacoModel: () => ITextModel };
  };

  constructor() {}

  updateUri(uri: string) {
    this.uri = new URI(uri);
    this.currentResource = { uri: this.uri };
  }

  updateCurrentTextModelWithString(text: string) {
    const textModel = createModel(text, undefined, monaco.Uri.parse(this.uri.toString()));
    this.currentCodeEditor = {
      currentDocumentModel: {
        getText: () => textModel.getValue(),
        getMonacoModel: () => textModel,
      },
    };
  }

  getAllOpenedUris() {
    return this.uri ? [this.uri] : [];
  }
}

describe('CollaborationService basic routines', () => {
  let injector: MockInjector;
  let service: CollaborationService;
  let server: YWebsocketServerImpl;
  let eventBus: IEventBus;
  let workbenchEditorService: MockWorkbenchEditorService;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.mockService(ILogger);
    injector.mockService(INodeLogger);
    injector.mockService(IFileService);
    injector.addProviders(
      {
        token: ICollaborationService,
        useClass: CollaborationService,
      },
      {
        token: IYWebsocketServer,
        useClass: YWebsocketServerImpl,
      },
      {
        token: CollaborationServiceForClientPath,
        useClass: CollaborationServiceForClient,
      },
    );
    injector.addProviders({
      token: IEventBus,
      useClass: EventBusImpl,
    });

    injector.addProviders({
      token: WorkbenchEditorService,
      useClass: MockWorkbenchEditorService,
    });
    workbenchEditorService = injector.get<MockWorkbenchEditorService>(WorkbenchEditorService);
    workbenchEditorService.updateUri('file://home/situ2001/114514/1919810');
    workbenchEditorService.updateCurrentTextModelWithString('');

    server = injector.get(YWebsocketServerImpl);
    eventBus = injector.get(IEventBus);
    service = injector.get(ICollaborationService);

    // mock impl, because origin impl comes with nodejs
    const serviceForClient: CollaborationServiceForClient = injector.get(CollaborationServiceForClientPath);
    jest.spyOn(serviceForClient, 'requestInitContent').mockImplementation(async (uri: string) => {
      if (!serviceForClient['yMap'].has(uri)) {
        serviceForClient['yMap'].set(uri, new Y.Text('init content'));
      }
    });

    // start server
    server.initialize();
  });

  it('should successfully initialize', () => {
    const spy = jest.spyOn(service, 'initialize');
    service.initialize();
    expect(spy).toBeCalled();
  });

  it('should create a new binding when EditorActiveResourceStateChanged', async () => {
    let _handler: () => void;
    const promise = new Promise((resolve) => {
      const handler = () => resolve(1);
      _handler = handler;
      service['yTextMap'].observe(handler);
    }).finally(() => service['yTextMap'].unobserve(_handler));

    const event = new EditorActiveResourceStateChangedEvent({
      openType: { type: 'code' },
      resource: null,
    });
    eventBus.fire(event);

    await promise;

    expect(service['getBinding'](workbenchEditorService.uri.toString())).toBeInstanceOf(TextModelBinding);
  });

  it('should call undo and redo on current binding', () => {
    const targetBinding = service['getBinding'](workbenchEditorService.uri.toString()) as TextModelBinding;
    expect(targetBinding).toBeInstanceOf(TextModelBinding);
    const undoSpy = jest.spyOn(targetBinding, 'undo');
    const redoSpy = jest.spyOn(targetBinding, 'redo');
    service.undoOnCurrentResource();
    service.redoOnCurrentResource();
    expect(undoSpy).toBeCalled();
    expect(redoSpy).toBeCalled();
  });

  it('should react on EditorGroupCloseEvent', () => {
    const event = new EditorGroupCloseEvent({
      resource: {
        uri: new URI(workbenchEditorService.uri.toString()),
      } as any,
      group: null as any,
    });
    const removeSpy = jest.spyOn(service as any, 'removeBinding');
    expect(service['bindingMap'].has(workbenchEditorService.uri.toString())).toBeTruthy();
    eventBus.fire(event);
    expect(removeSpy).toBeCalled();
    expect(service['bindingMap'].has(workbenchEditorService.uri.toString())).not.toBeTruthy();
  });

  it('should react on EditorActiveResourceStateChangedEvent', async () => {
    // change uri and textModel
    workbenchEditorService.updateUri('file://home/situ2001/114514/1919811');
    workbenchEditorService.updateCurrentTextModelWithString('');

    // promise that listens on yMapEvent
    let _handler: () => void;
    const promise = new Promise((resolve, reject) => {
      const handler = () => resolve(1);
      _handler = handler;
      service['yTextMap'].observe(handler);
    }).finally(() => service['yTextMap'].unobserve(_handler));

    const event = new EditorActiveResourceStateChangedEvent({
      openType: { type: 'code' },
      resource: null,
    });
    eventBus.fire(event);

    await promise;

    expect(service['bindingMap'].has(workbenchEditorService.uri.toString())).toBeTruthy();
    expect(service['getBinding'](workbenchEditorService.uri.toString())).toBeInstanceOf(TextModelBinding);
  });

  // TODO move to node side
  it('should react on FileChangeEvent', () => {
    // const handlerSpy = jest.spyOn(service as any, 'fileChangeEventHandler');
    const removeBindingSpy = jest.spyOn(service as any, 'removeBinding');

    // delete a file in a naive way
    service['yTextMap'].delete(workbenchEditorService.uri.toString());

    // expect(handlerSpy).toBeCalled();
    expect(removeBindingSpy).toBeCalled();
  });

  it('should successfully destroy', () => {
    const spy = jest.spyOn(service, 'destroy');
    service.destroy();
    expect(spy).toBeCalled();
  });

  afterAll(() => {
    server.dispose();
  });
});
