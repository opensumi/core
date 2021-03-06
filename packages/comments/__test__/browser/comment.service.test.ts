import { Injector } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { URI, positionToRange, Disposable } from '@opensumi/ide-core-common';
import { IEditor, EditorCollectionService, ResourceService } from '@opensumi/ide-editor';
import { IEditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector, mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { CommentsModule } from '../../src/browser';
import { ICommentsService, CommentMode } from '../../src/common';

describe('comment service test', () => {
  let injector: MockInjector;
  let commentsService: ICommentsService;
  let currentEditor: IEditor;
  beforeAll(() => {
    (global as any).monaco = createMockedMonaco() as any;
    const monacoEditor = mockService({
      getConfiguration: () => ({
        lineHeight: 20,
      }),
      onDidChangeConfiguration: () => Disposable.NULL,
      getLayoutInfo: () => ({
        minimapWidth: 10,
        minimapLeft: 10,
      }),
    });
    currentEditor = mockService({ monacoEditor });
    injector = createBrowserInjector(
      [CommentsModule],
      new Injector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: IIconService,
          useClass: IconService,
        },
        {
          token: ResourceService,
          useClass: ResourceServiceImpl,
        },
        {
          token: EditorCollectionService,
          useValue: mockService({
            listEditors: () => [currentEditor],
          }),
        },
        {
          token: IEditorDecorationCollectionService,
          useValue: mockService({
            registerDecorationProvider: () => Disposable.NULL,
          }),
        },
      ]),
    );
  });

  beforeEach(() => {
    commentsService = injector.get<ICommentsService>(ICommentsService);
    commentsService.init();
  });

  afterEach(() => {
    commentsService.dispose();
  });

  afterAll(() => {
    (global as any).monaco = undefined;
  });

  it('create thread', () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    expect(thread.uri.isEqual(uri));
    expect(thread.range.startLineNumber).toBe(1);
    expect(thread.comments[0].body).toBe('????????????1');
  });

  it('get commentsThreads', () => {
    const uri = URI.file('/test');
    const [thread, thread2] = createTestThreads(uri);
    expect(commentsService.commentsThreads.length).toBe(2);
    // ????????????????????????
    expect(commentsService.commentsThreads[0].id).toBe(thread.id);
    expect(commentsService.commentsThreads[1].id).toBe(thread2.id);
  });

  it('getThreadByUri', () => {
    const uri = URI.file('/test');
    const [thread, thread2] = createTestThreads(uri);
    const threads = commentsService.getThreadsByUri(uri);
    expect(threads.length).toBe(2);
    // ?????? range ????????????
    expect(threads[0].id).toBe(thread.id);
    expect(threads[1].id).toBe(thread2.id);
  });

  it('commentsTreeNodes', () => {
    const uri = URI.file('/test');
    const [thread, thread2] = createTestThreads(uri);
    thread.addComment({
      mode: CommentMode.Preview,
      author: {
        name: '??????',
      },
      body: '??????????????????',
    });
    const nodes = commentsService.commentsTreeNodes;
    // ???????????????????????????
    expect(nodes.length).toBe(4);
    // ???????????????????????????
    expect(nodes[0].parent).toBeUndefined();
    // ??????????????????????????? thread
    expect(nodes[0].thread).toBe(thread);
    // ?????????????????? url ??????
    expect(nodes[0].name).toBe('test');
    // ?????????????????????????????????
    expect(nodes[1].name).toBe('??????');
    // ????????????????????????????????????
    expect(nodes[1].description).toBe('????????????1');
    expect(nodes[1].thread).toBe(thread);
    // ????????????????????????????????????????????????
    expect(nodes[1].comment).toBe(thread.comments[0]);
    // ??????????????????????????? thread ???????????????
    expect(nodes[2].name).toBe('??????');
    expect(nodes[2].description).toBe('??????????????????');
    expect(nodes[2].comment).toBe(thread.comments[1]);
    // ?????????????????? parent ??????????????????
    expect(nodes[2].parent?.comment).toBe(thread.comments[0]);
    // ??????????????????????????? thread
    expect(nodes[3].description).toBe('????????????2');
    expect(nodes[3].thread.id).toBe(thread2.id);
  });

  it('onThreadsCreated', () => {
    const threadsCreatedListener = jest.fn();
    commentsService.onThreadsCreated(threadsCreatedListener);
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1), {
      comments: [
        {
          mode: CommentMode.Editor,
          author: {
            name: '??????',
          },
          body: '????????????1',
        },
      ],
    });
    expect(threadsCreatedListener.mock.calls.length).toBe(1);
    expect(threadsCreatedListener.mock.calls[0][0].id).toBe(thread.id);
  });

  it('onThreadsChanged', () => {
    const threadsChangedListener = jest.fn();
    commentsService.onThreadsChanged(threadsChangedListener);
    const uri = URI.file('/test');
    commentsService.createThread(uri, positionToRange(1), {
      comments: [
        {
          mode: CommentMode.Editor,
          author: {
            name: '??????',
          },
          body: '????????????1',
        },
      ],
    });
    expect(threadsChangedListener.mock.calls.length).toBe(1);
  });

  it('?????? showWidgetsIfShowed ????????????????????? widget ??????????????? show ??????', async () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    currentEditor.currentUri = uri;
    // ???????????? widget
    thread.show(currentEditor);
    // ??????????????????????????? isShow ??? false
    thread.hide();
    const widget = thread.getWidgetByEditor(currentEditor);
    expect(widget?.isShow).toBeFalsy();
    const onShow = jest.fn();
    widget?.onShow(onShow);
    thread.showWidgetsIfShowed();
    // ??????????????? show ??????
    expect(onShow).not.toBeCalled();
    expect(widget?.isShow).toBeFalsy();
  });

  it('?????? isShow ??? true ???????????? show ??????', async () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    currentEditor.currentUri = uri;
    // ???????????? widget
    thread.show(currentEditor);
    // ????????? dispose ????????????????????? isShow ?????? true
    thread.hideWidgetsByDispose();
    const widget = thread.getWidgetByEditor(currentEditor);
    expect(widget?.isShow).toBeTruthy();
    const onShow = jest.fn();
    widget?.onShow(onShow);
    thread.showWidgetsIfShowed();
    expect(onShow).toBeCalled();
  });

  it('?????? dispose ??????????????? widget??????????????? isShow', async () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    currentEditor.currentUri = uri;
    // ???????????? widget
    thread.show(currentEditor);
    const widget = thread.getWidgetByEditor(currentEditor);
    expect(widget?.isShow).toBeTruthy();
    thread.hideWidgetsByDispose();
    // ???????????????????????? show ??????????????????
    expect(widget?.isShow).toBeTruthy();
  });

  it('registerDecorationProvider to be recalled when register resource provider', () => {
    // @ts-ignore
    const $registerDecorationProvider = jest.spyOn(commentsService, 'registerDecorationProvider');
    const resourceProvider = injector.get<ResourceService>(ResourceService);
    resourceProvider.registerResourceProvider({
      scheme: 'pr',
      provideResource: () => mockService({}),
    });
    expect($registerDecorationProvider).toBeCalled();
  });

  function createTestThreads(uri: URI) {
    return [
      commentsService.createThread(uri, positionToRange(1), {
        comments: [
          {
            mode: CommentMode.Editor,
            author: {
              name: '??????',
            },
            body: '????????????1',
          },
        ],
      }),
      commentsService.createThread(uri, positionToRange(2), {
        comments: [
          {
            mode: CommentMode.Editor,
            author: {
              name: '??????',
            },
            body: '????????????2',
          },
        ],
      }),
    ];
  }
});
