/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Y from 'yjs';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { EventBusImpl, IEventBus, ILogger, URI } from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorDocumentModelCreationEvent,
  EditorDocumentModelRemovalEvent,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser';
import { IFileService } from '@opensumi/ide-file-service';
import { ITextModel } from '@opensumi/ide-monaco';
import { ICSSStyleService } from '@opensumi/ide-theme';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { CollaborationService } from '../../src/browser/collaboration.service';
import { TextModelBinding } from '../../src/browser/textmodel-binding';
import { CollaborationServiceForClientPath, ICollaborationService, IYWebsocketServer } from '../../src/common';
import { CollaborationServiceForClient } from '../../src/node/collaboration.service';
import { YWebsocketServerImpl } from '../../src/node/y-websocket-server';

@Injectable()
class MockWorkbenchEditorService {
  uri: URI;

  get currentResource() {
    return {
      uri: this.uri,
    };
  }
}

@Injectable()
class MockDocModelService {
  @Autowired(WorkbenchEditorService)
  private workbenchService: MockDocModelService;

  private textModel: ITextModel;

  getModelReference(uri: string) {
    return {
      dispose() {},
      instance: {
        getMonacoModel() {
          return monaco.editor.createModel('');
        },
      },
    };
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
    injector.mockService(ICSSStyleService);
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
      token: AppConfig,
      useValue: {
        wsPath: { toString: () => 'ws://127.0.0.1:8080' },
      },
    });

    injector.addProviders({
      token: WorkbenchEditorService,
      useClass: MockWorkbenchEditorService,
    });
    workbenchEditorService = injector.get<MockWorkbenchEditorService>(WorkbenchEditorService);
    const uriString = 'file://home/situ2001/114514/1919810';
    workbenchEditorService.uri = new URI(uriString);

    injector.addProviders({
      token: IEditorDocumentModelService,
      useClass: MockDocModelService,
    });

    server = injector.get(IYWebsocketServer);
    eventBus = injector.get(IEventBus);
    service = injector.get(ICollaborationService);

    // mock impl, because origin impl comes with nodejs
    jest.spyOn(server, 'requestInitContent').mockImplementation(async (uri: string) => {
      if (!server['yMap'].has(uri)) {
        server['yMap'].set(uri, new Y.Text('init content'));
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

  it('should create a new binding when all things are ready', async () => {
    const event = new EditorDocumentModelCreationEvent({
      uri: new URI(workbenchEditorService.uri.toString()),
    } as any);
    await eventBus.fireAndAwait(event);
    expect(service['bindingMap'].has(workbenchEditorService.uri.toString())).toBeTruthy();
  });

  it('should call undo and redo on current binding', () => {
    const targetBinding = service['getBinding'](workbenchEditorService.uri.toString()) as TextModelBinding;
    expect(targetBinding).toBeInstanceOf(TextModelBinding);
    const undoSpy = jest.spyOn(targetBinding, 'undo');
    const redoSpy = jest.spyOn(targetBinding, 'redo');
    service.undoOnFocusedTextModel();
    service.redoOnFocusedTextModel();
    expect(undoSpy).toBeCalled();
    expect(redoSpy).toBeCalled();
  });

  it('should change Y.Text when remote Y.Text was changed', async () => {
    // simulate Y.Text delete and add
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const binding = service['bindingMap'].get(workbenchEditorService.uri.toString())!;
    expect(binding).toBeInstanceOf(TextModelBinding);
    expect(binding['yText'].toJSON()).toBeTruthy();

    const spy = jest.spyOn(binding, 'changeYText');
    const { yMapReady } = service['getDeferred'](workbenchEditorService.uri.toString());

    service['yTextMap'].delete(workbenchEditorService.uri.toString());
    service['yTextMap'].set(workbenchEditorService.uri.toString(), new Y.Text('1919810'));

    await yMapReady.promise;

    expect(spy).toBeCalled();
    expect(binding['yText'].toJSON()).toBe('1919810');
  });

  it('should remove binding on EditorDocumentModelRemovalEvent', async () => {
    const event = new EditorDocumentModelRemovalEvent({
      codeUri: new URI(workbenchEditorService.uri.toString()),
    } as any);
    await eventBus.fireAndAwait(event);
    expect(service['bindingMap'].has(workbenchEditorService.uri.toString())).toBeFalsy();
  });

  it('should successfully destroy', () => {
    const spy = jest.spyOn(service, 'destroy');
    service.destroy();
    expect(spy).toBeCalled();
  });

  afterAll(() => {
    server.destroy();
  });
});
